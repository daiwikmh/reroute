#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _},
    vec, Bytes, IntoVal,
};

// A minimal stand-in for Reflector, controllable per-test via set_price, so
// get_price's conversion path can be exercised without a live oracle.
#[contract]
struct MockReflector;

#[contractimpl]
impl MockReflector {
    pub fn set_price(env: Env, asset: Asset, price: i128) {
        env.storage()
            .temporary()
            .set(&asset, &PriceData { price, timestamp: 0 });
    }

    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        env.storage().temporary().get(&asset)
    }
}

struct Fixture<'a> {
    env: Env,
    registry: EndpointRegistryClient<'a>,
    registry_id: Address,
    reflector: Address,
    #[allow(dead_code)]
    admin: Address,
    owner: Address,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().budget().reset_unlimited();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);

    let reflector = env.register(MockReflector, ());

    let registry_id = env.register(EndpointRegistry, ());
    let registry = EndpointRegistryClient::new(&env, &registry_id);
    registry.initialize(&admin, &reflector);

    Fixture { env, registry, registry_id, reflector, admin, owner }
}

fn domain(env: &Env, s: &str) -> Bytes {
    Bytes::from_slice(env, s.as_bytes())
}

#[test]
fn test_register_and_get_endpoint_round_trips() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    // Check events immediately after register() — an intervening read-only
    // call resets the recorded-events buffer in this SDK version.
    let domain_hash: BytesN<32> = f.env.crypto().sha256(&dom).into();
    assert_eq!(
        f.env.events().all(),
        vec![
            &f.env,
            (
                f.registry_id.clone(),
                (symbol_short!("register"), f.owner.clone(), domain_hash).into_val(&f.env),
                dom.clone().into_val(&f.env),
            ),
        ]
    );

    let endpoint = f.registry.get_endpoint(&dom);
    assert_eq!(endpoint.owner, f.owner);
    assert_eq!(endpoint.pay_to, pay_to);
    assert_eq!(endpoint.reference_asset, reference_asset);
    assert_eq!(endpoint.reference_price, 500);
    assert!(endpoint.active);

    let domains = f.registry.list_owner_domains(&f.owner);
    assert_eq!(domains.len(), 1);
}

#[test]
fn test_duplicate_domain_rejected() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    let result = f.registry.try_register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );
    assert_eq!(result, Err(Ok(Error::DomainAlreadyRegistered)));
}

#[test]
fn test_non_owner_cannot_update_price() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    let stranger = Address::generate(&f.env);
    let result = f.registry.try_update_price(&stranger, &dom, &reference_asset, &600);
    assert_eq!(result, Err(Ok(Error::NotOwner)));
}

#[test]
fn test_get_price_reference_asset_returns_sticker_price() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    assert_eq!(f.registry.get_price(&dom, &reference_asset), 500);
}

#[test]
fn test_get_price_converts_accepted_asset_via_reflector() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env); // priced at 1.00 by the mock
    let settlement_asset = Address::generate(&f.env); // priced at 0.50 by the mock
    let dom = domain(&f.env, "api.example.com");

    let mock = MockReflectorClient::new(&f.env, &f.reflector);
    mock.set_price(&Asset::Stellar(reference_asset.clone()), &1_0000000);
    mock.set_price(&Asset::Stellar(settlement_asset.clone()), &0_5000000);

    let mut accepted = Vec::new(&f.env);
    accepted.push_back(settlement_asset.clone());
    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500, // 500 units of reference_asset
        &accepted,
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    // 500 * 1.00 / 0.50 = 1000 units of the (half-priced) settlement asset.
    assert_eq!(f.registry.get_price(&dom, &settlement_asset), 1000);
}

#[test]
fn test_get_price_rejects_unaccepted_asset() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let unaccepted = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    let result = f.registry.try_get_price(&dom, &unaccepted);
    assert_eq!(result, Err(Ok(Error::AssetNotAccepted)));
}

#[test]
fn test_price_override_takes_precedence_over_reflector() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let settlement_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    let mock = MockReflectorClient::new(&f.env, &f.reflector);
    mock.set_price(&Asset::Stellar(reference_asset.clone()), &1_0000000);
    mock.set_price(&Asset::Stellar(settlement_asset.clone()), &1_0000000);

    let mut accepted = Vec::new(&f.env);
    accepted.push_back(settlement_asset.clone());
    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &accepted,
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    // Reflector says 1:1 (would give 500), but the pinned override wins.
    f.registry
        .set_price_override(&f.owner, &dom, &settlement_asset, &42);
    assert_eq!(f.registry.get_price(&dom, &settlement_asset), 42);

    f.registry.clear_price_override(&f.owner, &dom, &settlement_asset);
    assert_eq!(f.registry.get_price(&dom, &settlement_asset), 500);
}

#[test]
fn test_set_active_and_admin_deactivate() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &500,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    f.registry.set_active(&f.owner, &dom, &false);
    assert!(!f.registry.get_endpoint(&dom).active);

    f.registry.set_active(&f.owner, &dom, &true);
    assert!(f.registry.get_endpoint(&dom).active);

    f.registry.admin_deactivate(&dom);
    assert!(!f.registry.get_endpoint(&dom).active);
}

#[test]
fn test_zero_price_registers_as_verify_only() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "bank.example.com");

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &0,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    assert_eq!(f.registry.get_endpoint(&dom).reference_price, 0);
    assert_eq!(f.registry.get_price(&dom, &reference_asset), 0);

    // update_price can move a paid endpoint to verify-only and back.
    f.registry
        .update_price(&f.owner, &dom, &reference_asset, &500);
    assert_eq!(f.registry.get_price(&dom, &reference_asset), 500);
    f.registry.update_price(&f.owner, &dom, &reference_asset, &0);
    assert_eq!(f.registry.get_price(&dom, &reference_asset), 0);
}

#[test]
fn test_negative_price_still_rejected() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "api.example.com");

    let result = f.registry.try_register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &-1,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );
    assert_eq!(result, Err(Ok(Error::InvalidPrice)));
}

#[test]
fn test_payer_policy_open_by_default() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "bank.example.com");
    let payer = Address::generate(&f.env);

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &0,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    assert_eq!(f.registry.get_payer_policy(&dom), PayerPolicy::Open);
    assert!(f.registry.is_payer_allowed(&dom, &payer));
}

#[test]
fn test_payer_policy_allowlist_and_denylist() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "bank.example.com");
    let allowed = Address::generate(&f.env);
    let blocked = Address::generate(&f.env);

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &0,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    let mut allow = Vec::new(&f.env);
    allow.push_back(allowed.clone());
    f.registry
        .set_payer_policy(&f.owner, &dom, &PayerPolicy::Allowlist(allow));
    assert!(f.registry.is_payer_allowed(&dom, &allowed));
    assert!(!f.registry.is_payer_allowed(&dom, &blocked));

    let mut deny = Vec::new(&f.env);
    deny.push_back(blocked.clone());
    f.registry
        .set_payer_policy(&f.owner, &dom, &PayerPolicy::Denylist(deny));
    assert!(f.registry.is_payer_allowed(&dom, &allowed));
    assert!(!f.registry.is_payer_allowed(&dom, &blocked));
}

#[test]
fn test_non_owner_cannot_set_payer_policy() {
    let f = setup();
    let pay_to = Address::generate(&f.env);
    let reference_asset = Address::generate(&f.env);
    let dom = domain(&f.env, "bank.example.com");
    let stranger = Address::generate(&f.env);

    f.registry.register(
        &f.owner,
        &dom,
        &pay_to,
        &reference_asset,
        &0,
        &Vec::new(&f.env),
        &String::from_str(&f.env, "https://facilitator.example.com"),
    );

    let result = f
        .registry
        .try_set_payer_policy(&stranger, &dom, &PayerPolicy::Open);
    assert_eq!(result, Err(Ok(Error::NotOwner)));
}
