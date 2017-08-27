# TokenApp Smart Contract
The testing framework is [truffle](http://truffleframework.com/docs/getting_started/installation) and the goal is to test 
as many every corner case as possible in the smart contract.
The contract is based on ERC20, and uses code from the ERC20 Token
Standard [page](https://theethereum.wiki/w/index.php/ERC20_Token_Standard).

Although a partial ECR20 token without the functions `approve(...)`, 
`allowance(..)`, `transferFrom(...)`, and the event `Approval(...)` fits the purpuse, 
it was decided to implement the full standard. The token name is Modum Token
and the symbol MOD (not to be confused with 
[the file format](https://en.wikipedia.org/wiki/MOD_(file_format))).

The maximum amount of tokens are 30mio, where 9.9mio tokens are locked and can be only 
unlocked by the token holders by voting. The modum company itself initially 
does not have any tokens. 

This contract has 2 additions:

* **Bonus payment (airdrop)** A bonus payment starts by calling the default function. There 
 is no restriction, thus, anyone can pay ethers to this contract. In order to avoid
 rounding issues, only a multiple wei of the amount of unlocked tokens is considered.
 The modulo of the payin and unlocked tokens (remainder) is kept and added for the next
 payout. Thus, e.g., if there are 15'000'000 unlocked tokens and the bonus is 1 ETH 
 (1'000'000'000'000'000'000 wei), then the remainder is 10'000'000 and decucted from the
 bonus. Thus, the bonus payment is 999'999'999'990'000'000 / 15'000'000 = 66'666'666'666 
 wei per token. For a next payment e.g., 0.5 ETH (500'000'000'000'000'000 wei), the remainder 
 is added to 500'000'000'010'000'000. If any previous bonus payment has been done, the current
 wei per token is added to the previous one.
 
 Anyone that has modum tokens and if a bonus payment has been made, can claim it via
 `claimBonus()`. To check if there is a bonus, `showBonus()` can be called.

* **Voting** A vote starts by the owner of the contract calling 
`proposal(string _addr, bytes32 _hash, uint _value)`. The `addr` stores where the proposal
 document can be found, e.g. https://example.com/voting-document.pdf and the `hash` is the 
 SHA3 checksum of the document. The `value` in this proposal are the number of modum tokens
 that will we moved from the locked funds to the modum account. 
 
 The tokens are only moved from the locked funds to the modum account if a majority 
 approves. Every token holder can vote with `vote(bool _vote)` and 1 modum token is 
 equal to 1 vote.
 
 Once the voting phase is over (2 weeks), the owner can call `claimProposal()`. It was 
 decided against counting in blocks, as the current blocktime is 
 [>20sec](https://etherscan.io/chart/blocktime) and increasing due to the 
 [ice age](https://www.cryptocompare.com/coins/guides/what-is-the-ethereum-ice-age/), 
 thus, not suitable for defining a time period.
 
 In any case (accepted or rejected vote), after the voting phase, the owner has to 
 call `claimProposal()` in order to create new proposals. After the call, the proposal
 state is reset.
  
Since the voting and bonus payment are based on the number of tokens, it is important to 
handle the case of increasing / decreasing tokens in order not to claim more bonus or
voting rights. For these cases, `getAccount(...)` is used to update the number of weis
and voting rights. That means if a bonus has been payed of 1 wei per token at time 0 and
time 1, a user gets 10 tokens, then the user should not get any weis. For every transfer
the account of the sender and payer is updated and `getAccount(...)` is called with the
current value. In the example above, `getAccount(...)` is called with the token amount of 0,
the `lastAirdropWei` is updated and any subsequent call to `getAccount(...)` will result
in 0 wei. If now a second time a bonus is payed with 2 wei per token, then if the user
calls `getAccount(...)`, the `lastAirdropWei` does not match, and `account.bonusWei` is 
updated to `10 x 2 = 20 wei`. If the user gets more token afterwards, `account.bonusWei`
is already set and reflects the current tokens when the bonus way payed. A similar
mechanism is implemented for voting, however, the update of the voting power is done
only during the voting phase.

Minting is done once, and once the minting flag is set, it can never be unset. The rebates
for the tiers is calculated off-contract in the 
[minting backend](https://github.com/modum-io/tokenapp-backend/tree/master/services/minting).

# Contract Testing
[Truffle](http://truffleframework.com/docs/getting_started/installation) installation is
done via npm: 
```
sudo npm install -g truffle
```
For the ethereum client, [testrpc](https://github.com/ethereumjs/testrpc) is recommended, 
which can be installed via 
```
sudo npm install -g ethereumjs-testrpc
```
Next you have to clone the repository 
```
git clone git@github.com:modum-io/tokenapp-smartcontract.git
```
then go into that directory and start testing with 
```
testrpc
truffle test
```

## Logging
Please note that logging in Solidity works a bit different. In order to log, events have
to be created. These events are displayed in case of errors in truffle. If you still want
to see the events, one can attach the geth client with `geth attach http://localhost:8545`.
Once the console is running, add a filter:
```
var filter = web3.eth.filter({fromBlock: 0, toBlock: "latest"});
filter.watch(function (error, result) {
  console.log("RESULT: " + result.data);
});
//in case you want to stop watching, execute:
filter.stopWatching();
```
With this you can show any raw event e.g., (`event logA(string s, address a);`) that is fired
in Solidity.

## Monolithic vs. Modular
This contract relies on heavily used and community reviewed libraries such as
OpenZeppelin. We also used ERC20 functionality from [theethereum.wiki](https://theethereum.wiki/w/index.php/ERC20_Token_Standard).

Since the code is reasonably small, it is copied (after a thorough review)
directly into this contract. Suggestions to use a package manager such as npm
for these couple lines of code is overkill as well as splitting this contract
into multiple packages. Besides readability and maintainability suffers if small
files are split up instead of having it in a [single place](https://medium.com/@rdsubhas/10-modern-software-engineering-mistakes-bc67fbef4fc8).

The ERC20 Interface is from the [Ethereum Github page](https://github.com/ethereum/eips/issues/20). Although
OpenZeppelin suggests an improved interface, this contract uses the original ERC20 standard.

## Mixing Require() and Modifiers
At the beginning of many functions in the contract, require() functions are called
to check if certain conditions are met. Solidity allows to use modifiers such as onlyOwner() instead of
certain require(). In this contract these modifiers are not used with the goal to have everything
in one place. Thus, at the beginning of a function all requirements are set with require().