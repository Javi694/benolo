export const leagueFactoryAbi = [
  {
    inputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "leagueId",
            type: "bytes32",
          },
          {
            internalType: "address",
            name: "creator",
            type: "address",
          },
          {
            internalType: "address",
            name: "asset",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "entryAmount",
            type: "uint256",
          },
          {
            internalType: "uint16",
            name: "exitPenaltyBps",
            type: "uint16",
          },
          {
            internalType: "uint16",
            name: "commissionBps",
            type: "uint16",
          },
          {
            internalType: "bytes32",
            name: "strategyId",
            type: "bytes32",
          },
          {
            internalType: "bool",
            name: "canEarlyExit",
            type: "bool",
          },
        ],
        internalType: "struct ILeagueFactory.CreateParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "createLeague",
    outputs: [
      {
        internalType: "address",
        name: "vault",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
