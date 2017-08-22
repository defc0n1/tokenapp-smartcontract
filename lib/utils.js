var Utils = {
    testMint(contract, accounts, account0, account1, account2) {
        return contract.mint([accounts[0]], [account0], {from: accounts[0]
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 minting events were fired");
            assert.equal(retVal.logs[0].args.tokens.valueOf(), account0, "number of votes for account 0");
            return contract.mint([accounts[1], accounts[2]], [account1, account2], {from: accounts[0]});
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 2, "2 minting events were fired");
            assert.equal(retVal.logs[0].args.tokens.valueOf(), account1, "number of votes for account 1");
            assert.equal(retVal.logs[1].args.tokens.valueOf(), account2, "number of votes for account 2");
            return contract.setMintDone({from: accounts[0]});
        }).then(function (e) {
            return contract.showVotes.call(accounts[0], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(account0, retVal.valueOf(), "account0 minted wrong/vote");
            return contract.balanceOf.call(accounts[0], {from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(account0, retVal.valueOf(), "account0 minted wrong/balance");
            return contract.showVotes.call(accounts[1], {from: accounts[2]})
        }).then(function (retVal) {
            assert.equal(account1, retVal.valueOf(), "account1 minted wrong/vote");
            return contract.balanceOf.call(accounts[1], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(account1, retVal.valueOf(), "account1 minted wrong/balance");
            return contract.showVotes.call(accounts[2], {from: accounts[0]})
        }).then(function (retVal) {
            assert.equal(account2, retVal.valueOf(), "account2 minted wrong/vote");
            return contract.balanceOf.call(accounts[2], {from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(account2, retVal.valueOf(), "account2 minted wrong/balance");
        });
    },

    claimAndTestBonus(contract, account, expectedBonus) {
        var before;
        return contract.showBonus.call({
            from: account
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), expectedBonus, "expceted bonus");
            before = "" + web3.eth.getBalance(account);
            return contract.claimBonus({from: account});
        }).then(function (retVal) {
            var after = "" + web3.eth.getBalance(account);
            var test1 = parseInt(after.substr(after.length - 10));
            var test2 = parseInt(before.substr(before.length - 10));
            assert.equal(test1 - test2, expectedBonus, "payout needs to be successful");
        });
    },

    testVote(contract, accounts, proposeAmount, voteAccount1, voteAccount2, increaseAccount2, vote1, vote2, resultAccount0) {
        return contract.proposal("https://", "0x123", proposeAmount, {
            from: accounts[0]
        }).then(function (retVal) {
            return contract.vote(vote1, {from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(retVal.logs.length, 1, "1 event was fired from 1");
            assert.equal(retVal.logs[0].args.votes.valueOf(), voteAccount1, voteAccount1 + " votes from 1");
            if (increaseAccount2 > 0) {
                return contract.transfer(accounts[2], increaseAccount2, {from: accounts[0]})
            } else {
                return contract.balanceOf.call(accounts[2], {from: accounts[1]});
            }
        }).then(function (retVal) {
            if (increaseAccount2 > 0) {
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
            return contract.balanceOf.call(accounts[0], {from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(retVal.valueOf(), resultAccount0, "account 0 with " + resultAccount0 + "tokens");
        });
    },

    testTokens(contract, accounts, locked, total, account0, account1) {
        return contract.getLockedTokens.call({
            from: accounts[0]
        }).then(function (retVal) {
            assert.equal(locked, retVal.valueOf(), "locked wrong");
            return contract.totalSupply.call({from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(total, retVal.valueOf(), "total wrong");
            return contract.balanceOf.call(accounts[0], {from: accounts[2]})
        }).then(function (retVal) {
            assert.equal(account0, retVal.valueOf(), "account0 wrong");
            return contract.balanceOf.call(accounts[1], {from: accounts[3]})
        }).then(function (retVal) {
            assert.equal(account1, retVal.valueOf(), "account1 wrong");
        });
    },

    testVotingPhaseStatus(contract, accounts, ongoing, active, over) {
        return contract.isVoteOngoing.call({
            from: accounts[0]
        }).then(function (retVal) {
            assert.equal(ongoing, retVal.valueOf(), "ongoing flag wrong + (" + ongoing + "," + active + "," + over + ")");
            return contract.isProposalActive.call({from: accounts[2]})
        }).then(function (retVal) {
            assert.equal(active, retVal.valueOf(), "active flag wrong: (" + ongoing + "," + active + "," + over + ")");
            return contract.isVotingPhaseOver.call({from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(over, retVal.valueOf(), "over flag wrong (" + ongoing + "," + active + "," + over + ")");
        });
    }
}
module.exports = Utils