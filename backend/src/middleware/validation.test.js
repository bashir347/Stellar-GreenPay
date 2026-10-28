"use strict";

const { z } = require("zod");
const { validateBody } = require("./validation");

const schema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
  email: z.string().email().optional(),
});

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("validateBody", () => {
  it("replaces a valid body with parsed data and calls next once without arguments", () => {
    const originalBody = { name: "Alice", amount: "5", email: "alice@example.com" };
    const req = { body: originalBody };
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(req.body).toEqual({ name: "Alice", amount: 5, email: "alice@example.com" });
    expect(req.body).not.toBe(originalBody);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  // The current middleware returns 422 for validation failures, not 400.
  it("returns 422 with every failing field when multiple fields are invalid", () => {
    const req = { body: { name: "", amount: -1, email: "bad" } };
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0]).toEqual({
      error: "Validation failed",
      details: {
        name: "Too small: expected string to have >=1 characters",
        amount: "Too small: expected number to be >0",
        email: "Invalid email address",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 422 with required-field errors for an empty object", () => {
    const req = { body: {} };
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0]).toEqual({
      error: "Validation failed",
      details: {
        name: "Invalid input: expected string, received undefined",
        amount: "Invalid input: expected number, received NaN",
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "undefined"],
    [null, "null"],
    ["text", "string"],
    [[], "array"],
  ])("returns 422 without throwing for a %s body (received %s)", (body, received) => {
    const req = { body };
    const res = mockRes();
    const next = jest.fn();

    expect(() => validateBody(schema)(req, res, next)).not.toThrow();

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0]).toEqual({
      error: "Validation failed",
      details: { body: `Invalid input: expected object, received ${received}` },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("strips unknown keys from the parsed body by default", () => {
    // Pin strip-vs-reject behavior so a Zod upgrade or schema change cannot silently alter it.
    const req = { body: { name: "Alice", amount: "5", extra: true } };
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema)(req, res, next);

    expect(req.body).toEqual({ name: "Alice", amount: 5 });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns 422 for unknown keys when the schema is strict", () => {
    const req = { body: { name: "Alice", amount: "5", extra: true } };
    const res = mockRes();
    const next = jest.fn();

    validateBody(schema.strict())(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0]).toEqual({
      error: "Validation failed",
      details: { body: 'Unrecognized key: "extra"' },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
