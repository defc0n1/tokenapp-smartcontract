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

    it("test voting and voting successful", function () {
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
            //return contract.showVotes.call(accounts[1], {from: accounts[0]})
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
            sleepFor(2000);
            return contract.claimProposal({from: accounts[1]})
        }).then(function (retVal) {
            assert.equal(false, 0, "voting period not over yet");
        }).catch(function (e) {
            return testVotingPhaseStatus(contract, accounts, false, true, true);
        }).then(function (retVal) {
            return contract.claimProposal({from: accounts[0]})
        }).then(function (retVal) {
            return testTokens(contract, accounts, 0, 9900000 - 5000, 6000, 5950, 50);
        }).then(function (retVal) {
            return testVotingPhaseStatus(contract, accounts, false, false, true);
        });
    });

    function testTokens(contract, accounts, from, locked, total, account0, account1) {
        return contract.getLockedTokens.call({from: accounts[from]
        }).then(function (retVal) {
            assert.equal(locked, retVal.valueOf(), "locked wrong");
            return contract.totalSupply.call({from: accounts[from]})
        }).then(function (retVal) {
            assert.equal(total, retVal.valueOf(), "total wrong");
            return contract.balanceOf.call(accounts[0], {from: accounts[from]})
        }).then(function (retVal) {
            assert.equal(account0, retVal.valueOf(), "account0 wrong");
            return contract.balanceOf.call(accounts[1],{from: accounts[from]})
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

    function sleepFor( sleepDuration ){
        var now = new Date().getTime();
        while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
    }

});
