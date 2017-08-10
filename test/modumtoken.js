var ModumToken = artifacts.require("./ModumToken.sol");

contract('ModumToken', function (accounts) {


    //https://ethereum.stackexchange.com/questions/15567/truffle-smart-contract-testing-does-not-reset-state/15574#15574
    var contract;
    beforeEach(function () {
        return ModumToken.new()
            .then(function(instance) {
                contract = instance;
            });
    });

    const twoWeeks = 2 * 7 * 24 * 60 * 60;
    function waitTwoWeeks() {
        web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [twoWeeks], id: 0})
    }

    //************************** TEST ERC20 - the smart contract code is copy&paste from reliable sources ************
    it("test ERC20 basic functionality", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.balanceOf.call(accounts[0], {from: accounts[0]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 0, "everything should be empty");
            return contract.mint([accounts[0]], [1000], {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "only owner can mint");
        }).catch(function (e) {
            return contract.mint([accounts[0]], [1000], {from: accounts[0]});
        }).then(function (retVal) {
            return contract.balanceOf.call(accounts[0], {from: accounts[0]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "balance is 1000, seen by any account");
            return contract.balanceOf.call(accounts[0], {from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "balance is 1000, seen by any account");
            return contract.getUnlockedTokens.call({from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "unlocked tokens are 1000");
            return contract.totalSupply.call({from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 9900000 + 1000, "unlocked tokens are 1000");
            return contract.transfer(accounts[1], 1, {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "minting not done yet, cannot transfor");
        }).catch(function (e) {
            //minting done
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            return contract.transfer(accounts[1], 1, {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "account 1 does not have any tokens");
        }).catch(function (e) {
            return contract.transfer(accounts[1], 0, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "cannot transfor 0 tokens");
        }).catch(function (e) {
            return contract.transfer(accounts[1], -1, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "negative values are not possible");
        }).catch(function (e) {
            return contract.transfer(accounts[0], 1, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "cannot steal tokens from another account");
        }).catch(function (e) {
            return contract.transfer(accounts[0], 1001, {from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "account 0 only has 1000 tokens, cannot transfor 1001");
        }).catch(function (e) {
            return contract.transfer(accounts[0], 1000, {from: accounts[0]});
        }).then(function (retVal) {
            //transfer was successful
            return contract.balanceOf.call(accounts[0], {from: accounts[0]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "we sent from account 0 to account 0, so account 0 has still 1000 tokens");
            return contract.transfer(accounts[1], 1000, {from: accounts[0]});
        }).then(function (retVal) {
            return contract.balanceOf.call(accounts[0], {from: accounts[1]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 0, "we transfer all tokens to account 1");
            return contract.balanceOf.call(accounts[1], {from: accounts[2]});
        }).then(function (balance) {
            assert.equal(balance.valueOf(), 1000, "account 1 has 1000 tokenscd ");
        });
    });

    //no tests for allowance yet

    it("minting too much and bulk test", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.mint([accounts[0],accounts[1]], [1000, 20100000 - 1000], {from: accounts[0]});
        }).then(function (balance) {
            return contract.mint([accounts[2]], [1], {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "we have already sold all our tokens ");
        }).catch(function (e) {
            return testTokens(contract, accounts, 9900000, 20100000, 1000, 20100000 - 1000);
        });
    });

    it("minting too much and bulk test rollback", function () {
        return ModumToken.deployed().then(function (instance) {
            return  contract.mint([accounts[0],accounts[1], accounts[2]], [1000, 20100000 - 1000, 1], {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "we have already sold all our tokens ");
        }).catch(function (e) {
            return  testTokens(contract, accounts, 9900000, 0, 0, 0);
        })
    });

    it("test voting with phases and voting successful with token transfer in between", function () {
        return ModumToken.deployed().then(function (instance) {
            contract.mint([accounts[0]], [1000], {from: accounts[0]});
        }).then(function () {
            return contract.setMintDone({from: accounts[0]});
        }).then(function () {
            return contract.showVotes.call(accounts[0], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), 1000, "account 0 has 1000 votes");
            return contract.showVotes.call(accounts[1], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), 0, "account 1 have 0 votes");
            return testVotingPhaseStatus(contract, accounts, false, false, true);
        }).then(function (retVal) {
            return contract.proposal("https://", "0x123", 5000, {from: accounts[0]});
        }).then(function () {
            return contract.transfer(accounts[1], 50, {from: accounts[0]});
        }).then(function (e) {
            return contract.showVotes.call(accounts[1], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), 0, "account 1 have 0 votes");
            return contract.vote(true, {from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(false, "account 1 does not have any voting rights");
        }).catch(function (e) {
            //testVotingPhaseStatus(false, false, false)
            return contract.vote(true, {from: accounts[0]})
        }).then(function (retVal) {
            //https://ethereum.stackexchange.com/questions/16291/truffle-call-that-returns-contract-is-returning-tx
            //https://ethereum.stackexchange.com/questions/16796/truffle-console-how-can-i-get-and-print-the-value-returned-by-a-contract-funct
            //--> need to check for the event
            //http://truffleframework.com/docs/getting_started/contracts#catching-events
            assert.equal(retVal.logs.length, 1, "1 event was fired");
            assert.equal(retVal.logs[0].args.votes.valueOf(), 1000, "1000 votes");
            return contract.showVotes.call(accounts[0], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), 0, "account 0 already voted, so he has 0 votes");
            return contract.claimProposal({from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(false, 0, "voting period not over yet");
        }).catch(function (e) {
            return testVotingPhaseStatus(contract, accounts, true, true, false);
        }).then(function (retVal) {
            waitTwoWeeks();
            return contract.claimProposal({from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(false, 0, "voting period not over yet");
        }).catch(function (e) {
            return testVotingPhaseStatus(contract, accounts, false, true, true);
        }).then(function (retVal) {
            return contract.claimProposal({from: accounts[0]})
        }).then(function (retVal) {
            return testTokens(contract, accounts, 9900000 - 5000, 6000, 5950, 50);
        }).then(function (retVal) {
            return testVotingPhaseStatus(contract, accounts, false, false, true);
        });
    });

    it("test multiple voting, no increase", function () {
        return ModumToken.deployed().then(function (instance) {
        }).then(function (retVal) {
            return testMint(contract, accounts, 5000, 1001, 1000)
        }).then(function (retVal) {
            return testVote(contract, accounts, 5000, 1001, 1000, 0, true, false, 10000);
        }).then(function (retVal) {
            return testVote(contract, accounts, 8888, 1001, 1000, 0, false, true, 10000);
        }).then(function (retVal) {
            return testVote(contract, accounts, 9900000 - 5000, 1001, 1000, 0, true, false, 5000 + 9900000);
        }).then(function (retVal) {
            return contract.proposal("https://", "0x123", 1, {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, 0, "all locked tokens used");
        }).catch(function (e) {
            //this is expected
            return testTokens(contract, accounts, 0, 5000 + 9900000 + 1000 + 1001, 5000 + 9900000, 1001);
        });
    });

    it("test multiple voting, increase tokens for account 2", function () {
        return ModumToken.deployed().then(function (instance) {
        }).then(function (retVal) {
            return testMint(contract, accounts, 5000, 1001, 1000)
        }).then(function (retVal) {
            return testVote(contract, accounts, 5000, 1001, 1000, 100, true, false, 10000 - 100);
        }).then(function (retVal) {
            return testVote(contract, accounts, 8888, 1001, 1100, 200, true, false, 10000 - (100 + 200));
        }).then(function (retVal) {
            return testVote(contract, accounts, 9900000 - 5000, 1001, 1300, 0, false, true, 4700 + 9900000);
        }).then(function (retVal) {
            return contract.proposal("https://", "0x123", 1, {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, 0, "all locked tokens used");
        }).catch(function (e) {
            //this is expected
            return testTokens(contract, accounts, 0, 4700 + 9900000 + 1300 + 1001, 4700 + 9900000, 1001);
        });
    });

    it("test bonus payment", function() {
        return ModumToken.deployed().then(function (instance) {
        }).then(function (retVal) {
            return testMint(contract, accounts, 5000, 2000, 1000)
        }).then(function (retVal) {
            return contract.send(8001);
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired for bonus");
            assert.equal(retVal.logs[0].args.weiPerToken.valueOf(), 1, "expect 1 wei per token");
            return contract.send(7998);
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired for bonus");
            assert.equal(retVal.logs[0].args.weiPerToken.valueOf(), 0, "expect 1 wei per token");
            return contract.send(1);
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired for bonus");
            assert.equal(retVal.logs[0].args.weiPerToken.valueOf(), 1, "expect 1 wei per token");
        })
    });

    it("test bonus payment with payments in between", function() {
        var before;
        return ModumToken.deployed().then(function (instance) {
        }).then(function (retVal) {
            return testMint(contract, accounts, 500000, 200000, 100000)
        }).then(function (retVal) {
            return contract.send(800001);
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired for bonus");
            assert.equal(retVal.logs[0].args.weiPerToken.valueOf(), 1, "expect 1 wei per token");
            return contract.send(799998);
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired for bonus");
            assert.equal(retVal.logs[0].args.weiPerToken.valueOf(), 0, "expect 1 wei per token");
            return contract.transfer(accounts[1], 500000, {from: accounts[0]});
        }).then(function (retVal) {
            return contract.send(1);
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired for bonus");
            assert.equal(retVal.logs[0].args.weiPerToken.valueOf(), 1, "expect 1 wei per token");
            return claimAndTestBonus(contract, accounts[2], 200000);
        }).then(function (retVal) {
            return claimAndTestBonus(contract, accounts[1], 200000 + 700000);
        }).then(function (retVal) {
            return claimAndTestBonus(contract, accounts[3], 0);
        });
    });

    function claimAndTestBonus(contract, account, expectedBonus) {
        var before;
        return contract.showBonus.call({from: account
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), expectedBonus, "expceted bonus");
            before = "" + web3.eth.getBalance(account);
            return contract.claimBonus({from: account});
        }).then(function (retVal) {
            var after = "" + web3.eth.getBalance(account);
            var test1 = parseInt(after.substr(after.length-10));
            var test2 = parseInt(before.substr(before.length-10));
            assert.equal(test1 - test2, expectedBonus, "payout needs to be successful");
        });
    }

    //test gas usage for claimBonus(), only function that issues a transfer

    function testMint(contract, accounts, account0, account1, account2) {
        return contract.mint([accounts[0]], [account0], {from: accounts[0]
        }).then(function (retVal) {
            return contract.mint([accounts[1]], [account1], {from: accounts[0]});
        }).then(function (retVal) {
            return contract.mint([accounts[2]], [account2], {from: accounts[0]});
        }).then(function (retVal) {
            return contract.setMintDone({from: accounts[0]});
        }).then(function (e) {
            return contract.showVotes.call(accounts[0], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(account0, retVal.valueOf(), "account0 minted wrong/vote");
            return contract.balanceOf.call(accounts[0],{from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(account0, retVal.valueOf(), "account0 minted wrong/balance");
            return contract.showVotes.call(accounts[1], {from: accounts[2]})
        }).then(function (retVal) {
            assert.equal(account1, retVal.valueOf(), "account1 minted wrong/vote");
            return contract.balanceOf.call(accounts[1],{from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(account1, retVal.valueOf(), "account1 minted wrong/balance");
            return contract.showVotes.call(accounts[2], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(account2, retVal.valueOf(), "account2 minted wrong/vote");
            return contract.balanceOf.call(accounts[2],{from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(account2, retVal.valueOf(), "account2 minted wrong/balance");
        });
    }

    function testVote(contract, accounts, proposeAmount, voteAccount1, voteAccount2, increaseAccount2, vote1, vote2, resultAccount0) {
        return contract.proposal("https://", "0x123", proposeAmount, {from: accounts[0]
        }).then(function (retVal) {
            return contract.vote(vote1, {from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired from 1");
            assert.equal(retVal.logs[0].args.votes.valueOf(), voteAccount1, voteAccount1 + " votes from 1");
            if(increaseAccount2 > 0) {
                return contract.transfer(accounts[2], increaseAccount2, {from: accounts[0]})
            } else {
                return contract.balanceOf.call(accounts[2],{from: accounts[1]});
            }
        }).then(function (retVal) {
            if(increaseAccount2 > 0) {
                assert.equal(retVal.logs.length, 1, "1 transfer event fired");
                assert.equal(retVal.logs[0].args._value.valueOf(), increaseAccount2, increaseAccount2 + " from account0 to account2 before votes");
            }
            return contract.vote(vote2, {from: accounts[2]})
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired from 2");
            assert.equal(retVal.logs[0].args.votes.valueOf(), voteAccount2, voteAccount2 + " votes from 2");
            waitTwoWeeks();
            return contract.claimProposal({from: accounts[0]})
        }).then(function (retVal) {
            return contract.balanceOf.call(accounts[0],{from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), resultAccount0, "account 0 with "+resultAccount0+"tokens");
        });
    }

    function testTokens(contract, accounts, locked, total, account0, account1) {
        return contract.getLockedTokens.call({from: accounts[0]
        }).then(function (retVal) {
            assert.equal(locked, retVal.valueOf(), "locked wrong");
            return contract.totalSupply.call({from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(total, retVal.valueOf(), "total wrong");
            return contract.balanceOf.call(accounts[0], {from: accounts[2]})
        }).then(function (retVal) {
            assert.equal(account0, retVal.valueOf(), "account0 wrong");
            return contract.balanceOf.call(accounts[1],{from: accounts[3]})
        }).then(function (retVal) {
            assert.equal(account1, retVal.valueOf(), "account1 wrong");
        });
    }

    function testVotingPhaseStatus(contract, accounts, ongoing, active, over) {
        return contract.isVoteOngoing.call({from: accounts[0]
        }).then(function (retVal) {
            assert.equal(ongoing, retVal.valueOf(), "ongoing flag wrong + ("+ongoing+","+active+","+over+")");
            return contract.isProposalActive.call({from: accounts[2]})
        }).then(function (retVal) {
            assert.equal(active, retVal.valueOf(), "active flag wrong: ("+ongoing+","+active+","+over+")");
            return contract.isVotingPhaseOver.call({from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(over, retVal.valueOf(), "over flag wrong ("+ongoing+","+active+","+over+")");
        });
    }

    //************************** TEST Minting Flag *******************************
    it("minting flag tests", function () {
        return ModumToken.deployed().then(function (instance) {
            return contract.setMintDone({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(false, "minting finished can only be called from the owner");
        }).catch(function (e) {
            return contract.isMintDone.call({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), false, "minting is not done yet, we can call this from any account");
            return contract.isMintDone.call({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), false, "minting is still not done yet, we can call this from any account");
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            //console.log("now minting is set to done");
            return contract.setMintDone({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(false, "cannot call minting done this twice");
        }).catch(function (e) {
            return contract.isMintDone.call({from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), true, "minting is done, we can call this from any account");
            return contract.isMintDone.call({from: accounts[1]});
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), true, "minting is done, we can call this from any account");
        });
    });
});
