#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contractclient, contracttype, Address,
    Bytes, BytesN, Env, String, Symbol, Vec,
};

// ── Reflector interface ──────────────────────────────────────────────────────
//
// Reflector has no published Rust crate, so the client is hand-declared from
// its verified deployed interface (base=USD, decimals=14 on the CEX/DEX
// aggregate feed) rather than imported. Only the one call this contract needs
// is declared; the rest of Reflector's interface is irrelevant here.

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[contractclient(name = "ReflectorClient")]
pub trait ReflectorInterface {
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized      = 1,
    AlreadyInitialized  = 2,
    DomainAlreadyRegistered = 3,
    NoSuchEndpoint      = 4,
    NotOwner            = 5,
    InvalidPrice        = 6,
    AssetNotAccepted    = 7,
    NoPriceForAsset     = 8,
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Reflector,
    Endpoint(BytesN<32>),                 // domain hash -> Endpoint
    PriceOverride(BytesN<32>, Address),   // (domain hash, settlement asset) -> fixed price
    OwnerDomains(Address),                // owner -> Vec<domain hash>
    Policy(BytesN<32>),                   // domain hash -> PayerPolicy, defaults Open
}

const TTL_BUMP: u32 = 518_400; // ~30 days at 5s/ledger

// ── Types ────────────────────────────────────────────────────────────────────

// A seller's sticker price is denominated in one reference asset. Any other
// asset in accepted_assets settles by converting through Reflector at call
// time, not by maintaining N independently-drifting prices — the same reason
// savings_pool keeps accrual asset-denominated rather than normalising to USD
// at every checkpoint. price_override exists only for a seller who wants one
// specific accepted asset pinned to a fixed rate instead of floating.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Endpoint {
    pub domain: Bytes,
    pub owner: Address,
    pub pay_to: Address,
    pub reference_asset: Address,
    pub reference_price: i128,
    pub accepted_assets: Vec<Address>,
    pub facilitator_url: String,
    pub active: bool,
    pub registered_at: u64,
    pub updated_at: u64,
}

// Who may pay/verify against this endpoint. Kept separate from Endpoint
// itself (its own storage slot) because it changes on a different rhythm —
// pricing is set once and rarely touched, an allow/deny list is exactly the
// kind of thing an institution wants to edit often without re-touching
// anything else about the registration.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PayerPolicy {
    Open,
    Allowlist(Vec<Address>),
    Denylist(Vec<Address>),
}

// ── Events ───────────────────────────────────────────────────────────────────
//
// The DNS sync job polls these instead of re-scanning full contract state,
// the same role Deposit/Withdraw play for savings_pool's off-chain ledger.

// Only one non-topic field is allowed per "single-value" event, so these
// carry just enough to identify what changed — the sync job re-reads full
// current state via get_endpoint rather than the event replaying it.
//
// get_endpoint takes the plaintext domain, not its hash, and the contract
// keeps no reverse hash->domain index — so Register's one data field carries
// the plaintext domain, the only point at which the sync job can ever learn
// it. Every later event only needs the hash, since by then the job has
// already cached the mapping from this first event.
#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Register {
    #[topic]
    pub owner: Address,
    #[topic]
    pub domain_hash: BytesN<32>,
    pub domain: Bytes,
}

#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatePrice {
    #[topic]
    pub domain_hash: BytesN<32>,
    pub reference_price: i128,
}

#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdateAssets {
    #[topic]
    pub domain_hash: BytesN<32>,
}

#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SetActive {
    #[topic]
    pub domain_hash: BytesN<32>,
    pub active: bool,
}

#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminDeactivate {
    #[topic]
    pub domain_hash: BytesN<32>,
}

#[contractevent(data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SetPayerPolicy {
    #[topic]
    pub domain_hash: BytesN<32>,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct EndpointRegistry;

#[contractimpl]
impl EndpointRegistry {
    pub fn initialize(e: Env, admin: Address, reflector: Address) -> Result<(), Error> {
        if e.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Reflector, &reflector);
        e.storage().instance().extend_ttl(TTL_BUMP, TTL_BUMP);
        Ok(())
    }

    pub fn register(
        e: Env,
        owner: Address,
        domain: Bytes,
        pay_to: Address,
        reference_asset: Address,
        reference_price: i128,
        accepted_assets: Vec<Address>,
        facilitator_url: String,
    ) -> Result<(), Error> {
        owner.require_auth();
        // Zero is a real, deliberate price: verify-only. A caller still has to
        // present a valid signed payment payload for a $0 amount, so the
        // endpoint gets the same proof-of-identity and audit trail as a paid
        // one — an institution that wants attribution without monetizing
        // shouldn't need a workaround to express that.
        if reference_price < 0 {
            return Err(Error::InvalidPrice);
        }

        let key = Self::domain_key(&e, &domain);
        let ekey = DataKey::Endpoint(key.clone());
        if e.storage().persistent().has(&ekey) {
            return Err(Error::DomainAlreadyRegistered);
        }

        let now = e.ledger().timestamp();
        let endpoint = Endpoint {
            domain: domain.clone(),
            owner: owner.clone(),
            pay_to,
            reference_asset: reference_asset.clone(),
            reference_price,
            accepted_assets,
            facilitator_url,
            active: true,
            registered_at: now,
            updated_at: now,
        };
        Self::put_endpoint(&e, &key, &endpoint);

        let odkey = DataKey::OwnerDomains(owner.clone());
        let mut domains: Vec<BytesN<32>> = e
            .storage()
            .persistent()
            .get(&odkey)
            .unwrap_or(Vec::new(&e));
        domains.push_back(key.clone());
        e.storage().persistent().set(&odkey, &domains);
        e.storage()
            .persistent()
            .extend_ttl(&odkey, TTL_BUMP, TTL_BUMP);

        Register { owner, domain_hash: key, domain }.publish(&e);
        Ok(())
    }

    pub fn update_price(
        e: Env,
        owner: Address,
        domain: Bytes,
        reference_asset: Address,
        reference_price: i128,
    ) -> Result<(), Error> {
        if reference_price < 0 {
            return Err(Error::InvalidPrice);
        }
        let (key, mut endpoint) = Self::load_owned(&e, &domain, &owner)?;
        endpoint.reference_asset = reference_asset;
        endpoint.reference_price = reference_price;
        endpoint.updated_at = e.ledger().timestamp();
        Self::put_endpoint(&e, &key, &endpoint);

        UpdatePrice { domain_hash: key, reference_price }.publish(&e);
        Ok(())
    }

    pub fn set_accepted_assets(
        e: Env,
        owner: Address,
        domain: Bytes,
        accepted_assets: Vec<Address>,
    ) -> Result<(), Error> {
        let (key, mut endpoint) = Self::load_owned(&e, &domain, &owner)?;
        endpoint.accepted_assets = accepted_assets;
        endpoint.updated_at = e.ledger().timestamp();
        Self::put_endpoint(&e, &key, &endpoint);

        UpdateAssets { domain_hash: key }.publish(&e);
        Ok(())
    }

    // Soft toggle, not delete — a lapsed endpoint's DNS TXT record can then
    // self-report inactive without the sync job needing a separate tombstone
    // concept.
    pub fn set_active(e: Env, owner: Address, domain: Bytes, active: bool) -> Result<(), Error> {
        let (key, mut endpoint) = Self::load_owned(&e, &domain, &owner)?;
        endpoint.active = active;
        endpoint.updated_at = e.ledger().timestamp();
        Self::put_endpoint(&e, &key, &endpoint);

        SetActive { domain_hash: key, active }.publish(&e);
        Ok(())
    }

    // No endpoint-state field to bump here — the policy has its own slot
    // and its own change cadence, not tied to Endpoint.updated_at.
    pub fn set_payer_policy(
        e: Env,
        owner: Address,
        domain: Bytes,
        policy: PayerPolicy,
    ) -> Result<(), Error> {
        let (key, _) = Self::load_owned(&e, &domain, &owner)?;
        let pkey = DataKey::Policy(key.clone());
        e.storage().persistent().set(&pkey, &policy);
        e.storage()
            .persistent()
            .extend_ttl(&pkey, TTL_BUMP, TTL_BUMP);

        SetPayerPolicy { domain_hash: key }.publish(&e);
        Ok(())
    }

    pub fn set_price_override(
        e: Env,
        owner: Address,
        domain: Bytes,
        asset: Address,
        price: i128,
    ) -> Result<(), Error> {
        if price < 0 {
            return Err(Error::InvalidPrice);
        }
        let (key, endpoint) = Self::load_owned(&e, &domain, &owner)?;
        if !endpoint.accepted_assets.contains(&asset) && asset != endpoint.reference_asset {
            return Err(Error::AssetNotAccepted);
        }
        let okey = DataKey::PriceOverride(key, asset);
        e.storage().persistent().set(&okey, &price);
        e.storage()
            .persistent()
            .extend_ttl(&okey, TTL_BUMP, TTL_BUMP);
        Ok(())
    }

    pub fn clear_price_override(
        e: Env,
        owner: Address,
        domain: Bytes,
        asset: Address,
    ) -> Result<(), Error> {
        let (key, _) = Self::load_owned(&e, &domain, &owner)?;
        e.storage()
            .persistent()
            .remove(&DataKey::PriceOverride(key, asset));
        Ok(())
    }

    // Separate from the owner's own set_active: a moderation kill switch the
    // seller cannot re-enable themselves.
    pub fn admin_deactivate(e: Env, domain: Bytes) -> Result<(), Error> {
        Self::admin(&e)?.require_auth();
        let key = Self::domain_key(&e, &domain);
        let mut endpoint = Self::endpoint(&e, &key)?;
        endpoint.active = false;
        endpoint.updated_at = e.ledger().timestamp();
        Self::put_endpoint(&e, &key, &endpoint);

        AdminDeactivate { domain_hash: key }.publish(&e);
        Ok(())
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_endpoint(e: Env, domain: Bytes) -> Result<Endpoint, Error> {
        let key = Self::domain_key(&e, &domain);
        Self::endpoint(&e, &key)
    }

    pub fn get_payer_policy(e: Env, domain: Bytes) -> PayerPolicy {
        let key = Self::domain_key(&e, &domain);
        e.storage()
            .persistent()
            .get(&DataKey::Policy(key))
            .unwrap_or(PayerPolicy::Open)
    }

    // The backend's proxy calls this directly rather than fetching the
    // policy and matching it client-side — keeps the allow/deny rule itself
    // living in exactly one place.
    pub fn is_payer_allowed(e: Env, domain: Bytes, payer: Address) -> bool {
        match Self::get_payer_policy(e, domain) {
            PayerPolicy::Open => true,
            PayerPolicy::Allowlist(list) => list.contains(&payer),
            PayerPolicy::Denylist(list) => !list.contains(&payer),
        }
    }

    // Reference asset returns the sticker price as-is. An accepted asset with
    // an override returns the pinned rate. Any other accepted asset converts
    // through Reflector at the current price, priced at call time rather than
    // at registration time, so nobody locks in a stale rate.
    pub fn get_price(e: Env, domain: Bytes, settlement_asset: Address) -> Result<i128, Error> {
        let key = Self::domain_key(&e, &domain);
        let endpoint = Self::endpoint(&e, &key)?;

        if settlement_asset == endpoint.reference_asset {
            return Ok(endpoint.reference_price);
        }
        if let Some(price) = e
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::PriceOverride(key, settlement_asset.clone()))
        {
            return Ok(price);
        }
        if !endpoint.accepted_assets.contains(&settlement_asset) {
            return Err(Error::AssetNotAccepted);
        }

        let reflector = Self::reflector_address(&e)?;
        Self::convert_price(
            &e,
            &reflector,
            &endpoint.reference_asset,
            endpoint.reference_price,
            &settlement_asset,
        )
    }

    pub fn list_owner_domains(e: Env, owner: Address) -> Vec<BytesN<32>> {
        e.storage()
            .persistent()
            .get(&DataKey::OwnerDomains(owner))
            .unwrap_or(Vec::new(&e))
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn admin(e: &Env) -> Result<Address, Error> {
        e.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    fn reflector_address(e: &Env) -> Result<Address, Error> {
        e.storage()
            .instance()
            .get(&DataKey::Reflector)
            .ok_or(Error::NotInitialized)
    }

    fn domain_key(e: &Env, domain: &Bytes) -> BytesN<32> {
        e.crypto().sha256(domain).into()
    }

    fn put_endpoint(e: &Env, key: &BytesN<32>, endpoint: &Endpoint) {
        let ekey = DataKey::Endpoint(key.clone());
        e.storage().persistent().set(&ekey, endpoint);
        e.storage()
            .persistent()
            .extend_ttl(&ekey, TTL_BUMP, TTL_BUMP);
    }

    fn endpoint(e: &Env, key: &BytesN<32>) -> Result<Endpoint, Error> {
        e.storage()
            .persistent()
            .get(&DataKey::Endpoint(key.clone()))
            .ok_or(Error::NoSuchEndpoint)
    }

    // Loads an endpoint and proves the caller both signed and owns it. A
    // caller that signs as some other address just fails require_auth; a
    // caller that signs correctly but names the wrong domain/owner pair gets
    // NotOwner instead of silently mutating someone else's endpoint.
    fn load_owned(e: &Env, domain: &Bytes, owner: &Address) -> Result<(BytesN<32>, Endpoint), Error> {
        owner.require_auth();
        let key = Self::domain_key(e, domain);
        let endpoint = Self::endpoint(e, &key)?;
        if &endpoint.owner != owner {
            return Err(Error::NotOwner);
        }
        Ok((key, endpoint))
    }

    // Both assets are read from the same Reflector deployment, so they share
    // one base currency and decimal scale and it cancels out of the ratio —
    // no decimals() call needed, unlike a conversion across two oracles.
    fn convert_price(
        e: &Env,
        reflector: &Address,
        reference_asset: &Address,
        reference_price: i128,
        settlement_asset: &Address,
    ) -> Result<i128, Error> {
        let client = ReflectorClient::new(e, reflector);
        let ref_price = client
            .lastprice(&Asset::Stellar(reference_asset.clone()))
            .ok_or(Error::NoPriceForAsset)?;
        let settle_price = client
            .lastprice(&Asset::Stellar(settlement_asset.clone()))
            .ok_or(Error::NoPriceForAsset)?;
        if settle_price.price <= 0 {
            return Err(Error::NoPriceForAsset);
        }
        reference_price
            .checked_mul(ref_price.price)
            .and_then(|v| v.checked_div(settle_price.price))
            .ok_or(Error::InvalidPrice)
    }
}

mod test;
