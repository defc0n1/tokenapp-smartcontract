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

    it("test gas bonus calculation", function() {
        var beforeAccount1;
        return ModumToken.deployed().then(function (instance) {
        }).then(function (retVal) {
            return utils.testMint(contract, accounts, 500000, 200000, 100000)
        }).then(function (retVal) {
            return contract.send(800000);
        }).then(function (retVal) {
            beforeAccount1 = web3.toBigNumber(web3.eth.getBalance(accounts[1]));
            return contract.claimBonus({from: accounts[1]});
        }).then(function (retVal) {
            const txFee = web3.toBigNumber(web3.eth.getTransactionReceipt(retVal.tx).gasUsed).times(
                web3.toBigNumber(web3.eth.getTransaction(retVal.tx).gasPrice));
            const afterAccount1Expected = (beforeAccount1.minus(txFee)).plus(web3.toBigNumber(200000));
            const afterAccount1 = web3.toBigNumber(web3.eth.getBalance(accounts[1]));
            assert.equal(afterAccount1.toString(), afterAccount1Expected.toString(), "gas calculation wrong");
        });
    });

});
