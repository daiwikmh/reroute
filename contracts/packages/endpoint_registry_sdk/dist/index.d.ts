import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions, Result } from "@stellar/stellar-sdk/contract";
import type { u64, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCLAFEUKE42FBXJATTADK4XNDUZNEGJERYWQWAI5INIGN3D63SB2RBC6";
    };
};
export type Asset = {
    tag: "Stellar";
    values: readonly [string];
} | {
    tag: "Other";
    values: readonly [string];
};
export declare const Errors: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
    4: {
        message: string;
    };
    5: {
        message: string;
    };
    6: {
        message: string;
    };
    7: {
        message: string;
    };
    8: {
        message: string;
    };
};
export type DataKey = {
    tag: "Admin";
    values: void;
} | {
    tag: "Reflector";
    values: void;
} | {
    tag: "Endpoint";
    values: readonly [Buffer];
} | {
    tag: "PriceOverride";
    values: readonly [Buffer, string];
} | {
    tag: "OwnerDomains";
    values: readonly [string];
} | {
    tag: "Policy";
    values: readonly [Buffer];
};
export interface Endpoint {
    accepted_assets: Array<string>;
    active: boolean;
    domain: Buffer;
    facilitator_url: string;
    owner: string;
    pay_to: string;
    reference_asset: string;
    reference_price: i128;
    registered_at: u64;
    updated_at: u64;
}
export interface PriceData {
    price: i128;
    timestamp: u64;
}
export type PayerPolicy = {
    tag: "Open";
    values: void;
} | {
    tag: "Allowlist";
    values: readonly [Array<string>];
} | {
    tag: "Denylist";
    values: readonly [Array<string>];
};
export interface Client {
    /**
     * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    register: ({ owner, domain, pay_to, reference_asset, reference_price, accepted_assets, facilitator_url }: {
        owner: string;
        domain: Buffer;
        pay_to: string;
        reference_asset: string;
        reference_price: i128;
        accepted_assets: Array<string>;
        facilitator_url: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_price: ({ domain, settlement_asset }: {
        domain: Buffer;
        settlement_asset: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>;
    /**
     * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    initialize: ({ admin, reflector }: {
        admin: string;
        reflector: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a set_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_active: ({ owner, domain, active }: {
        owner: string;
        domain: Buffer;
        active: boolean;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_endpoint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_endpoint: ({ domain }: {
        domain: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<Endpoint>>>;
    /**
     * Construct and simulate a update_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    update_price: ({ owner, domain, reference_asset, reference_price }: {
        owner: string;
        domain: Buffer;
        reference_asset: string;
        reference_price: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a admin_deactivate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    admin_deactivate: ({ domain }: {
        domain: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a get_payer_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_payer_policy: ({ domain }: {
        domain: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<PayerPolicy>>;
    /**
     * Construct and simulate a is_payer_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    is_payer_allowed: ({ domain, payer }: {
        domain: Buffer;
        payer: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a set_payer_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_payer_policy: ({ owner, domain, policy }: {
        owner: string;
        domain: Buffer;
        policy: PayerPolicy;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a list_owner_domains transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    list_owner_domains: ({ owner }: {
        owner: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Array<Buffer>>>;
    /**
     * Construct and simulate a set_price_override transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_price_override: ({ owner, domain, asset, price }: {
        owner: string;
        domain: Buffer;
        asset: string;
        price: i128;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a set_accepted_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_accepted_assets: ({ owner, domain, accepted_assets }: {
        owner: string;
        domain: Buffer;
        accepted_assets: Array<string>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
    /**
     * Construct and simulate a clear_price_override transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    clear_price_override: ({ owner, domain, asset }: {
        owner: string;
        domain: Buffer;
        asset: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        register: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_price: (json: string) => AssembledTransaction<Result<bigint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        initialize: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        set_active: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_endpoint: (json: string) => AssembledTransaction<Result<Endpoint, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        update_price: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        admin_deactivate: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        get_payer_policy: (json: string) => AssembledTransaction<PayerPolicy>;
        is_payer_allowed: (json: string) => AssembledTransaction<boolean>;
        set_payer_policy: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        list_owner_domains: (json: string) => AssembledTransaction<Buffer[]>;
        set_price_override: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        set_accepted_assets: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
        clear_price_override: (json: string) => AssembledTransaction<Result<void, import("@stellar/stellar-sdk/contract").ErrorMessage>>;
    };
}
