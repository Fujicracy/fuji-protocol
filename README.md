# 🗻Fuji Finance

> Borrowing Aggregator

Fuji is a protocol that aims to optimize loan expenses for DeFi users. It achieves this by monitoring the borrowing markets and whenever there is a better rate, it refinances the debt its users.
More details could be found [here](https://docs.fujidao.org/).

---

## Quickstart

### 1. Setup

Create a file `.env` and set at least one of the following:
```
ALCHEMY_ID=<your-key>
INFURA_ID=<your-key>
```

### 2. Install dependancies and run a mainnet fork
```
yarn install
yarn fork
```

### 3. Deploy contracts
```
# core markets
npx hardhat run scripts/mainnet/00_initial_deploy.js
```
```
# fuse markets
npx hardhat run scripts/mainnet/01_deploy_fuse.js
```
```
# fantom markets
npx hardhat run scripts/fantom/00_initial_deploy.js
```

### 4. Tests
```
npx hardhat test --network localhost test/<file-with-tests>.js 
```

### 5. Requirements
- node: 14.17.1
- yarn: 1.22.10

## Coding Style and Conventions

We use [solhint](https://github.com/protofire/solhint/blob/master/docs/rules.md) as a linter and [prettier](https://prettier.io/docs/en/index.html) as a code formatter.

A non-exhausitve list with some synthax rules:

- Contract names must be CamelCase, so the file containg it.
- Public and external functions name must be in camelCase.
- Private and internal functions name must be in _camelCase.
- Getter functions must be in getCamelCase.
- Setter functions must be in setCamelCase.
- Function parameters must be in _camelCase.
- Event names must be in CamelCase.
- Modifier name must be in mixedCase.
- Private and internal variables must be in _camelCase.
- Public variables must be in camelCase.
