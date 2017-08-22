var ModumToken = artifacts.require("./ModumToken.sol");
var utils = require('../lib/utils');

contract('ModumToken', function (accounts) {


    //https://ethereum.stackexchange.com/questions/15567/truffle-smart-contract-testing-does-not-reset-state/15574#15574
    var contract;
    beforeEach(function () {
        return ModumToken.new()
            .then(function(instance) {
                contract = instance;
            });
    });

    it("test bonus payment", function() {
        return ModumToken.deployed().then(function (instance) {
        }).then(function (retVal) {
            return utils.testMint(contract, accounts, 5000, 2000, 1000)
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
            return utils.testMint(contract, accounts, 500000, 200000, 100000)
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
            return utils.claimAndTestBonus(contract, accounts[2], 200000);
        }).then(function (retVal) {
            return utils.claimAndTestBonus(contract, accounts[1], 200000 + 700000);
        }).then(function (retVal) {
            return utils.claimAndTestBonus(contract, accounts[3], 0);
        });
    });


});
