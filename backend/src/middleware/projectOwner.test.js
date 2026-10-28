"use strict";

jest.mock("../db/pool", () => ({ query: jest.fn() }));
jest.mock("../services/webhook", () => ({ deliverPayload: jest.fn() }));

const express = require("express");
const request = require("supertest");
const { Keypair } = require("@stellar/stellar-sdk");
const pool = require("../db/pool");
const { signToken, walletAuthRequired } = require("./auth");
const { isProjectOwner, verifySignedChallenge } = require("./projectOwner");
const webhooksRouter = require("../routes/webhooks");

const OWNER = Keypair.random();
const OTHER = Keypair.random();
const PROJECT_ID = "project-owner-test";
const LOOKUP_SQL = "SELECT id, wallet_address, webhook_url, webhook_secret FROM projects WHERE id = $1";

function walletToken(wallet = OWNER.publicKey(), expiresIn = "5m") {
  return signToken({ type: "wallet", sub: wallet }, expiresIn);
}

function buildApp(onError) {
  const app = express();
  app.use("/api/webhooks", webhooksRouter);
  app.use((err, _req, res, _next) => {
    onError(err);
    res.status(500).json({ error: err.message });
  });
  return app;
}

describe("project owner authorization", () => {
  let app;
  let onError;
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.resetAllMocks();
    onError = jest.fn();
    app = buildApp(onError);
    req = {
      headers: { authorization: `Bearer ${walletToken()}` },
      get: jest.fn((name) => name === "X-Wallet-Address" ? OWNER.publicKey() : undefined),
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    pool.query.mockResolvedValue({ rows: [{
      id: PROJECT_ID,
      wallet_address: OWNER.publicKey(),
      webhook_url: null,
      webhook_secret: null,
    }] });
  });

  test("authenticates the owner and calls next once without an error or response", () => {
    walletAuthRequired(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.walletAddress).toBe(OWNER.publicKey());
    expect(isProjectOwner(req, OWNER.publicKey())).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("returns the project for an authenticated owner using the requested project id", async () => {
    const response = await request(app).get(`/api/webhooks/${PROJECT_ID}`)
      .set("Authorization", `Bearer ${walletToken()}`)
      .set("X-Wallet-Address", OWNER.publicKey());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: {
      projectId: PROJECT_ID, webhookUrl: null, webhookSecretMasked: null, configured: false,
    } });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(LOOKUP_SQL, [PROJECT_ID]);
    expect(onError).not.toHaveBeenCalled();
  });

  test.each([OTHER.publicKey(), OWNER.publicKey()])(
    "returns 403 for a non-owner token even with wallet header %s", async (header) => {
      const response = await request(app).get(`/api/webhooks/${PROJECT_ID}`)
        .set("Authorization", `Bearer ${walletToken(OTHER.publicKey())}`)
        .set("X-Wallet-Address", header);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "Only the project owner can view webhook configuration" });
      expect(response.body.data).toBeUndefined();
      expect(onError).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["missing token", () => undefined, "Missing or malformed Authorization header"],
    ["malformed token", () => "Bearer not-a-jwt", "Invalid wallet token"],
    ["expired token", () => `Bearer ${walletToken(OWNER.publicKey(), -1)}`, "Wallet token expired"],
    ["wrong-secret token", () => {
      const original = process.env.JWT_SECRET;
      try {
        process.env.JWT_SECRET = `${original || ""}-project-owner-wrong-secret`;
        return `Bearer ${walletToken()}`;
      } finally {
        if (original === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = original;
      }
    }, "Invalid wallet token"],
    ["non-wallet token", () => `Bearer ${signToken({ sub: OWNER.publicKey(), type: "admin" }, "5m")}`, "Invalid wallet token"],
    ["wallet token without a subject", () => `Bearer ${signToken({ type: "wallet" }, "5m")}`, "Invalid wallet token"],
  ])("returns 401 and never calls next for %s", async (_name, authorization, error) => {
    const header = authorization();
    req.headers = header ? { authorization: header } : {};
    walletAuthRequired(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error });
    expect(next).not.toHaveBeenCalled();
    expect(req.walletAddress).toBeUndefined();

    const pending = request(app).get(`/api/webhooks/${PROJECT_ID}`)
      .set("X-Wallet-Address", OWNER.publicKey());
    if (header) pending.set("Authorization", header);
    const response = await pending;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error });
    expect(pool.query).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  test("returns 404 when the project lookup returns no rows", async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const response = await request(app).get(`/api/webhooks/${PROJECT_ID}`)
      .set("Authorization", `Bearer ${walletToken()}`)
      .set("X-Wallet-Address", OWNER.publicKey());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Project not found" });
    expect(pool.query).toHaveBeenCalledWith(LOOKUP_SQL, [PROJECT_ID]);
    expect(onError).not.toHaveBeenCalled();
  });

  test("forwards database errors instead of treating them as authorization success", async () => {
    const error = new Error("lookup failed");
    pool.query.mockRejectedValue(error);
    const response = await request(app).get(`/api/webhooks/${PROJECT_ID}`)
      .set("Authorization", `Bearer ${walletToken()}`)
      .set("X-Wallet-Address", OWNER.publicKey());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "lookup failed" });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  test.each([
    ["unsigned owner header", undefined, OWNER.publicKey(), false],
    ["non-owner identity", OTHER.publicKey(), OWNER.publicKey(), false],
    ["surrounding header whitespace", OWNER.publicKey(), ` ${OWNER.publicKey()} `, true],
    ["lowercase header", OWNER.publicKey(), OWNER.publicKey().toLowerCase(), false],
    ["missing header", OWNER.publicKey(), undefined, false],
    ["non-string header", OWNER.publicKey(), [OWNER.publicKey()], false],
  ])("handles %s without granting ownership to an unverified identity", (_name, wallet, header, expected) => {
    req.walletAddress = wallet;
    req.get.mockImplementation((name) => name === "X-Wallet-Address" ? header : undefined);
    expect(isProjectOwner(req, OWNER.publicKey())).toBe(expected);
  });

  test.each(["valid", "wrong signer", "tampered", "missing challenge", "missing signature", "malformed signature"])(
    "requires optional challenge verification: %s", (kind) => {
      const challenge = "project-owner-challenge";
      const signer = kind === "wrong signer" ? OTHER : OWNER;
      const signature = Buffer.from(signer.sign(Buffer.from(challenge))).toString("base64");
      const headers = {
        "X-Wallet-Address": OWNER.publicKey(),
        "X-Wallet-Challenge": kind === "missing challenge" ? undefined : kind === "tampered" ? "changed" : challenge,
        "X-Wallet-Signature": kind === "missing signature" ? undefined : kind === "malformed signature" ? "not-base64" : signature,
      };
      req.walletAddress = OWNER.publicKey();
      const headerMap = new Map(Object.entries(headers));
      req.get.mockImplementation((name) => headerMap.get(name));

      expect(isProjectOwner(req, OWNER.publicKey())).toBe(kind === "valid");
    },
  );

  test("returns false instead of throwing for an invalid public key", () => {
    expect(verifySignedChallenge("invalid", "challenge", "signature")).toBe(false);
  });

  test.each(["get", "patch"])("rejects an unsigned owner header on a %s action", async (method) => {
    const path = method === "get" ? `${PROJECT_ID}/history` : `${PROJECT_ID}/test`;
    const pending = method === "get"
      ? request(app).get(`/api/webhooks/${path}`)
      : request(app).patch(`/api/webhooks/${path}`);
    const response = await pending.set("X-Wallet-Address", OWNER.publicKey());

    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
