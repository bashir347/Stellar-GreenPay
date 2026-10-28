// tests/cross_contract_pause.rs
//
// Cross-contract pause integration test for Escrow and GreenPay contracts.
//
// This test deploys both compiled contracts in one "Env", links them, and
// verifies that pausing GreenPay blocks "create_job" and "release_milestone",
// while unpausing restores normal operations.
//
// Runs under plain `cargo test --workspace` (contracts CI): the testutils
// capability comes from the dev-dependency on `soroban-sdk`, so no feature
// flag is required to compile or execute this suite.

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::StellarAssetClient,
    Address, BytesN, Env, String as SorobanString, Vec,
};

use escrow_contract::{EscrowContract, EscrowContractClient, JobStatus, Milestone};
use greenpay_contract::{GreenPayContract, GreenPayContractClient};

#[test]
fn test_cross_contract_pause_blocks_escrow_operations() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy GreenPay contract
    let greenpay_id = env.register_contract(None, GreenPayContract);
    let greenpay_client = GreenPayContractClient::new(&env, &greenpay_id);
    let greenpay_admin = Address::generate(&env);
    greenpay_client.initialize(&greenpay_admin);

    // Deploy Escrow contract
    let escrow_id = env.register_contract(None, EscrowContract);
    let escrow_client = EscrowContractClient::new(&env, &escrow_id);
    let escrow_admin = Address::generate(&env);
    escrow_client.initialize(&escrow_admin);

    // Link escrow contract to greenpay contract
    escrow_client.set_greenpay_contract(&escrow_admin, &greenpay_id);

    // Setup for escrow operations
    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();
    StellarAssetClient::new(&env, &token).mint(&client_addr, &2000i128);

    let job_id = SorobanString::from_str(&env, "job-1");

    let mut milestones = Vec::new(&env);
    milestones.push_back(Milestone {
        name: SorobanString::from_str(&env, "Milestone 1"),
        percentage: 100,
        released: false,
    });

    // Create job should work when not paused
    escrow_client.create_job(
        &client_addr,
        &freelancer_addr,
        &job_id,
        &token,
        &1000i128,
        &milestones,
    );
    let job = escrow_client.get_job(&job_id).expect("Job should exist");
    assert_eq!(job.status, JobStatus::Escrowed);

    // Pause GreenPay contract
    greenpay_client.pause(&greenpay_admin);

    // Create new job should fail when GreenPay is paused
    let job_id2 = SorobanString::from_str(&env, "job-2");
    let result = escrow_client.try_create_job(
        &client_addr,
        &freelancer_addr,
        &job_id2,
        &token,
        &500i128,
        &milestones,
    );
    assert!(
        result.is_err(),
        "create_job should fail when GreenPay is paused"
    );

    // release_milestone should fail when GreenPay is paused
    let result = escrow_client.try_release_milestone(&client_addr, &job_id, &0u32);
    assert!(
        result.is_err(),
        "release_milestone should fail when GreenPay is paused"
    );

    // Unpause GreenPay contract
    greenpay_client.unpause(&greenpay_admin);

    // After unpausing, operations should work again
    escrow_client.release_milestone(&client_addr, &job_id, &0u32);
    let job = escrow_client.get_job(&job_id).expect("Job should exist");
    assert_eq!(job.status, JobStatus::Completed);
}

#[test]
fn test_cross_contract_pause_blocks_release_funds() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy GreenPay contract
    let greenpay_id = env.register_contract(None, GreenPayContract);
    let greenpay_client = GreenPayContractClient::new(&env, &greenpay_id);
    let greenpay_admin = Address::generate(&env);
    greenpay_client.initialize(&greenpay_admin);

    // Deploy Escrow contract
    let escrow_id = env.register_contract(None, EscrowContract);
    let escrow_client = EscrowContractClient::new(&env, &escrow_id);
    let escrow_admin = Address::generate(&env);
    escrow_client.initialize(&escrow_admin);

    // Link escrow contract to greenpay contract
    escrow_client.set_greenpay_contract(&escrow_admin, &greenpay_id);

    // Setup
    let client_addr = Address::generate(&env);
    let freelancer_addr = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();
    StellarAssetClient::new(&env, &token).mint(&client_addr, &1000i128);

    let job_id = SorobanString::from_str(&env, "job-release");
    let mut milestones = Vec::new(&env);
    milestones.push_back(Milestone {
        name: SorobanString::from_str(&env, "Milestone 1"),
        percentage: 100,
        released: false,
    });

    // Create job
    escrow_client.create_job(
        &client_addr,
        &freelancer_addr,
        &job_id,
        &token,
        &1000i128,
        &milestones,
    );

    // Pause and verify release_funds is blocked
    greenpay_client.pause(&greenpay_admin);
    let report_hash = BytesN::from_array(&env, &[0xab; 32]);
    let result = escrow_client.try_release_funds(&escrow_admin, &job_id, &report_hash);
    assert!(
        result.is_err(),
        "release_funds should fail when GreenPay is paused"
    );

    // Unpause and verify it works
    greenpay_client.unpause(&greenpay_admin);
    let released = escrow_client.release_funds(&escrow_admin, &job_id, &report_hash);
    assert_eq!(released, 1000i128);
}
