import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCLAFEUKE42FBXJATTADK4XNDUZNEGJERYWQWAI5INIGN3D63SB2RBC6",
  }
} as const

export type Asset = {tag: "Stellar", values: readonly [string]} | {tag: "Other", values: readonly [string]};

export const Errors = {
  1: {message:"NotInitialized"},
  2: {message:"AlreadyInitialized"},
  3: {message:"DomainAlreadyRegistered"},
  4: {message:"NoSuchEndpoint"},
  5: {message:"NotOwner"},
  6: {message:"InvalidPrice"},
  7: {message:"AssetNotAccepted"},
  8: {message:"NoPriceForAsset"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Reflector", values: void} | {tag: "Endpoint", values: readonly [Buffer]} | {tag: "PriceOverride", values: readonly [Buffer, string]} | {tag: "OwnerDomains", values: readonly [string]} | {tag: "Policy", values: readonly [Buffer]};


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


export type PayerPolicy = {tag: "Open", values: void} | {tag: "Allowlist", values: readonly [Array<string>]} | {tag: "Denylist", values: readonly [Array<string>]};





export interface Client {
  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register: ({owner, domain, pay_to, reference_asset, reference_price, accepted_assets, facilitator_url}: {owner: string, domain: Buffer, pay_to: string, reference_asset: string, reference_price: i128, accepted_assets: Array<string>, facilitator_url: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_price: ({domain, settlement_asset}: {domain: Buffer, settlement_asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, reflector}: {admin: string, reflector: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_active transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_active: ({owner, domain, active}: {owner: string, domain: Buffer, active: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_endpoint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_endpoint: ({domain}: {domain: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Endpoint>>>

  /**
   * Construct and simulate a update_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_price: ({owner, domain, reference_asset, reference_price}: {owner: string, domain: Buffer, reference_asset: string, reference_price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a admin_deactivate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_deactivate: ({domain}: {domain: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_payer_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_payer_policy: ({domain}: {domain: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<PayerPolicy>>

  /**
   * Construct and simulate a is_payer_allowed transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_payer_allowed: ({domain, payer}: {domain: Buffer, payer: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_payer_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_payer_policy: ({owner, domain, policy}: {owner: string, domain: Buffer, policy: PayerPolicy}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a list_owner_domains transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  list_owner_domains: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Buffer>>>

  /**
   * Construct and simulate a set_price_override transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_price_override: ({owner, domain, asset, price}: {owner: string, domain: Buffer, asset: string, price: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_accepted_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_accepted_assets: ({owner, domain, accepted_assets}: {owner: string, domain: Buffer, accepted_assets: Array<string>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a clear_price_override transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  clear_price_override: ({owner, domain, asset}: {owner: string, domain: Buffer, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAABUFzc2V0AAAAAAAAAgAAAAEAAAAAAAAAB1N0ZWxsYXIAAAAAAQAAABMAAAABAAAAAAAAAAVPdGhlcgAAAAAAAAEAAAAR",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAXRG9tYWluQWxyZWFkeVJlZ2lzdGVyZWQAAAAAAwAAAAAAAAAOTm9TdWNoRW5kcG9pbnQAAAAAAAQAAAAAAAAACE5vdE93bmVyAAAABQAAAAAAAAAMSW52YWxpZFByaWNlAAAABgAAAAAAAAAQQXNzZXROb3RBY2NlcHRlZAAAAAcAAAAAAAAAD05vUHJpY2VGb3JBc3NldAAAAAAI",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABgAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAJUmVmbGVjdG9yAAAAAAAAAQAAAAAAAAAIRW5kcG9pbnQAAAABAAAD7gAAACAAAAABAAAAAAAAAA1QcmljZU92ZXJyaWRlAAAAAAAAAgAAA+4AAAAgAAAAEwAAAAEAAAAAAAAADE93bmVyRG9tYWlucwAAAAEAAAATAAAAAQAAAAAAAAAGUG9saWN5AAAAAAABAAAD7gAAACA=",
        "AAAAAQAAAAAAAAAAAAAACEVuZHBvaW50AAAACgAAAAAAAAAPYWNjZXB0ZWRfYXNzZXRzAAAAA+oAAAATAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAABmRvbWFpbgAAAAAADgAAAAAAAAAPZmFjaWxpdGF0b3JfdXJsAAAAABAAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGcGF5X3RvAAAAAAATAAAAAAAAAA9yZWZlcmVuY2VfYXNzZXQAAAAAEwAAAAAAAAAPcmVmZXJlbmNlX3ByaWNlAAAAAAsAAAAAAAAADXJlZ2lzdGVyZWRfYXQAAAAAAAAGAAAAAAAAAAp1cGRhdGVkX2F0AAAAAAAG",
        "AAAABQAAAAAAAAAAAAAACFJlZ2lzdGVyAAAAAQAAAAhyZWdpc3RlcgAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAAAAAAC2RvbWFpbl9oYXNoAAAAA+4AAAAgAAAAAQAAAAAAAAAGZG9tYWluAAAAAAAOAAAAAAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAACVByaWNlRGF0YQAAAAAAAAIAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==",
        "AAAABQAAAAAAAAAAAAAACVNldEFjdGl2ZQAAAAAAAAEAAAAKc2V0X2FjdGl2ZQAAAAAAAgAAAAAAAAALZG9tYWluX2hhc2gAAAAD7gAAACAAAAABAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAAA==",
        "AAAAAgAAAAAAAAAAAAAAC1BheWVyUG9saWN5AAAAAAMAAAAAAAAAAAAAAARPcGVuAAAAAQAAAAAAAAAJQWxsb3dsaXN0AAAAAAAAAQAAA+oAAAATAAAAAQAAAAAAAAAIRGVueWxpc3QAAAABAAAD6gAAABM=",
        "AAAABQAAAAAAAAAAAAAAC1VwZGF0ZVByaWNlAAAAAAEAAAAMdXBkYXRlX3ByaWNlAAAAAgAAAAAAAAALZG9tYWluX2hhc2gAAAAD7gAAACAAAAABAAAAAAAAAA9yZWZlcmVuY2VfcHJpY2UAAAAACwAAAAAAAAAA",
        "AAAABQAAAAAAAAAAAAAADFVwZGF0ZUFzc2V0cwAAAAEAAAANdXBkYXRlX2Fzc2V0cwAAAAAAAAEAAAAAAAAAC2RvbWFpbl9oYXNoAAAAA+4AAAAgAAAAAQAAAAA=",
        "AAAABQAAAAAAAAAAAAAADlNldFBheWVyUG9saWN5AAAAAAABAAAAEHNldF9wYXllcl9wb2xpY3kAAAABAAAAAAAAAAtkb21haW5faGFzaAAAAAPuAAAAIAAAAAEAAAAA",
        "AAAABQAAAAAAAAAAAAAAD0FkbWluRGVhY3RpdmF0ZQAAAAABAAAAEGFkbWluX2RlYWN0aXZhdGUAAAABAAAAAAAAAAtkb21haW5faGFzaAAAAAPuAAAAIAAAAAEAAAAA",
        "AAAAAAAAAAAAAAAIcmVnaXN0ZXIAAAAHAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmRvbWFpbgAAAAAADgAAAAAAAAAGcGF5X3RvAAAAAAATAAAAAAAAAA9yZWZlcmVuY2VfYXNzZXQAAAAAEwAAAAAAAAAPcmVmZXJlbmNlX3ByaWNlAAAAAAsAAAAAAAAAD2FjY2VwdGVkX2Fzc2V0cwAAAAPqAAAAEwAAAAAAAAAPZmFjaWxpdGF0b3JfdXJsAAAAABAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAJZ2V0X3ByaWNlAAAAAAAAAgAAAAAAAAAGZG9tYWluAAAAAAAOAAAAAAAAABBzZXR0bGVtZW50X2Fzc2V0AAAAEwAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAlyZWZsZWN0b3IAAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAKc2V0X2FjdGl2ZQAAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZkb21haW4AAAAAAA4AAAAAAAAABmFjdGl2ZQAAAAAAAQAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAMZ2V0X2VuZHBvaW50AAAAAQAAAAAAAAAGZG9tYWluAAAAAAAOAAAAAQAAA+kAAAfQAAAACEVuZHBvaW50AAAAAw==",
        "AAAAAAAAAAAAAAAMdXBkYXRlX3ByaWNlAAAABAAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAZkb21haW4AAAAAAA4AAAAAAAAAD3JlZmVyZW5jZV9hc3NldAAAAAATAAAAAAAAAA9yZWZlcmVuY2VfcHJpY2UAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAQYWRtaW5fZGVhY3RpdmF0ZQAAAAEAAAAAAAAABmRvbWFpbgAAAAAADgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAQZ2V0X3BheWVyX3BvbGljeQAAAAEAAAAAAAAABmRvbWFpbgAAAAAADgAAAAEAAAfQAAAAC1BheWVyUG9saWN5AA==",
        "AAAAAAAAAAAAAAAQaXNfcGF5ZXJfYWxsb3dlZAAAAAIAAAAAAAAABmRvbWFpbgAAAAAADgAAAAAAAAAFcGF5ZXIAAAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAQc2V0X3BheWVyX3BvbGljeQAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAGZG9tYWluAAAAAAAOAAAAAAAAAAZwb2xpY3kAAAAAB9AAAAALUGF5ZXJQb2xpY3kAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAASbGlzdF9vd25lcl9kb21haW5zAAAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAD6gAAA+4AAAAg",
        "AAAAAAAAAAAAAAASc2V0X3ByaWNlX292ZXJyaWRlAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmRvbWFpbgAAAAAADgAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAAAAAAVwcmljZQAAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAATc2V0X2FjY2VwdGVkX2Fzc2V0cwAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmRvbWFpbgAAAAAADgAAAAAAAAAPYWNjZXB0ZWRfYXNzZXRzAAAAA+oAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAUY2xlYXJfcHJpY2Vfb3ZlcnJpZGUAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAABmRvbWFpbgAAAAAADgAAAAAAAAAFYXNzZXQAAAAAAAATAAAAAQAAA+kAAAACAAAAAw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    register: this.txFromJSON<Result<void>>,
        get_price: this.txFromJSON<Result<i128>>,
        initialize: this.txFromJSON<Result<void>>,
        set_active: this.txFromJSON<Result<void>>,
        get_endpoint: this.txFromJSON<Result<Endpoint>>,
        update_price: this.txFromJSON<Result<void>>,
        admin_deactivate: this.txFromJSON<Result<void>>,
        get_payer_policy: this.txFromJSON<PayerPolicy>,
        is_payer_allowed: this.txFromJSON<boolean>,
        set_payer_policy: this.txFromJSON<Result<void>>,
        list_owner_domains: this.txFromJSON<Array<Buffer>>,
        set_price_override: this.txFromJSON<Result<void>>,
        set_accepted_assets: this.txFromJSON<Result<void>>,
        clear_price_override: this.txFromJSON<Result<void>>
  }
}