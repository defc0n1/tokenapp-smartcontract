pragma solidity ^0.4.10;

//https://theethereum.wiki/w/index.php/ERC20_Token_Standard
contract ERC20Interface {

    // Get the total token supply
    function totalSupply() constant returns (uint256 totalSupply);

    // Get the account balance of another account with address _owner
    function balanceOf(address _owner) constant returns (uint256 balance);

    // Send _value amount of tokens to address _to
    function transfer(address _to, uint256 _value) returns (bool success);

    // Send _value amount of tokens from address _from to address _to
    function transferFrom(address _from, address _to, uint256 _value) returns (bool success);

    // Allow _spender to withdraw from your account, multiple times, up to the _value amount.
    // If this function is called again it overwrites the current allowance with _value.
    // this function is required for some DEX functionality
    function approve(address _spender, uint256 _value) returns (bool success);

    // Returns the amount which _spender is still allowed to withdraw from _owner
    function allowance(address _owner, address _spender) constant returns (uint256 remaining);
    // Triggered when tokens are transferred.
    event Transfer(address indexed _from, address indexed _to, uint256 _value);

    // Triggered whenever approve(address _spender, uint256 _value) is called.
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

contract ModumToken is ERC20Interface {
    
    address owner;
    mapping(address => Account) accounts;
    mapping(address => mapping (address => uint256)) allowed;
    
    enum UpdateMode{None,Wei,Vote,Both}

	struct Account {
	    uint lastProposalStartBlockNr; //For checking at which proposal valueModVote was last updated 
		uint lastAirdropWei; //For checking after which airDrop bonusWei was last updated 
		uint bonusWei;      //airDrop/Dividend payout avaiable for withdrawl
		uint valueModVote;  // votes avaiable for voting on active Proposal
		uint valueMod;      // the owned tokens
    }
    
    uint totalDropPerUnlockedToken = 0;     //totally airdropped eth per unlocked token
    uint rounding = 0;                      //airdrops not accounted yet to make system rounding error proof

    uint unlockedTokens = 0;                //tokens that can vote, transfer, receive dividend
    uint lockedTokens = 9 * 1100 * 1000;   //token that need to be unlocked by voting
    uint maxTokens = 30 * 1000 * 1000;      //max distributable tokens

    bool mintDone = false;           //distinguisher for minting phase
    uint votingDurationBlocks = 15 ;        //15x14s = 210s = 3.5min 
    
    string public constant name = "Modum Token";
    string public constant symbol = "MOD";
    
    struct Proposal {
        string addr;        //Uri for more info
        bytes32 hash;       //Hash of the uri content for checking 
        uint valueMod;      //token to unlock: proposal with 0 amount is invalid
        uint startBlockNr;     
        uint yay;   
        uint nay;
    }
    
    Proposal currentProposal; 

    function ModumToken() {
        owner = msg.sender;
    }
	
	event Minted(address _addr, uint tokens);
	event Voted(address _addr, bool option, uint votes);
	event Payout(uint weiPerToken);

    //TODO:DEBUG REMOVE
    event logA(string s, address a);
    event logB(string s, bool a);
    
    function proposal(string _addr, bytes32 _hash, uint _value) {
        require(currentProposal.valueMod == 0); // no vote is ongoing
        require(msg.sender == owner); // proposal ony by onwer
        require(lockedTokens >= _value); //proposal cannot be larger than remaining locked tokens
        require(_value > 0);            //proposal with 0 unlock are invalid
        uint _yay = 0;
        uint _nay = 0;
        currentProposal = Proposal(_addr, _hash, _value, block.number, _yay, _nay);
    }
    
    function vote(bool _vote) returns (uint) {
        require(isVoteOngoing()); // vote needs to be ongoing
        Account storage account = getAccount(msg.sender, UpdateMode.Vote);
        uint votes = account.valueModVote;  //avaiable votes
        require(votes > 0);  //voter must have a vote left
        
        if(! _vote) {
            currentProposal.nay = safeAdd(currentProposal.nay,votes);
        } else {
            currentProposal.yay = safeAdd(currentProposal.yay,votes);
        }
        
        account.valueModVote = 0;
		Voted(msg.sender,_vote,votes);
        return votes;
    }
    
    function claimProposal(){
        require(mintDone); //minting phase needs to be over
        require(msg.sender == owner); //only owner can claim proposal
        require(currentProposal.valueMod > 0); // no proposal active
        require(block.number > safeAdd(currentProposal.startBlockNr,votingDurationBlocks)); // voting has already ended
        if(currentProposal.yay > currentProposal.nay) {
            //It was accepted
            Account storage account = getAccount(owner, UpdateMode.Both);
            uint valueMod = currentProposal.valueMod;
            account.valueMod = safeAdd(account.valueMod, valueMod); //uadd to owner
            unlockedTokens = safeAdd(unlockedTokens,valueMod); //unlock
            lockedTokens = safeSub(lockedTokens,valueMod); //unlock
        }
        delete currentProposal; //proposal ended
    }
    
    //TODO: do a bulk version
    function mint(address _recipient, uint _value)  {
        require(msg.sender == owner); //only owner can claim proposal
        require(!mintDone); //only during minting
        require(safeAdd(totalSupply(),_value) <= maxTokens); //do not exceed max
        Account storage account = getAccount(_recipient, UpdateMode.Both);
        account.valueMod = safeAdd(account.valueMod,_value); //create the tokens and add to recipient
        unlockedTokens = safeAdd(unlockedTokens,_value); //create tokens
		Minted(_recipient, _value);
    }
    
    function setMintDone() {
        /* logA("1", msg.sender);
        logA("2", owner);
        logB("3", mintDone); */
        require(msg.sender == owner); //only owner
        require(!mintDone); //only in minting
        mintDone = true; //end the minting
    }

    function isMintDone() constant returns (bool) {
        return mintDone;
    }
    
    //default function to pay bonus, anybody that sends eth to this contract will distribute the wei
    //to their token holders
    //Dividend payment / Airdrop
    function() payable {
        uint value = safeAdd(msg.value,rounding); //add old runding
        rounding = value % unlockedTokens; //ensure no rounding error
		uint weiPerToken = safeDiv(safeSub(value,rounding),unlockedTokens);
        totalDropPerUnlockedToken = safeAdd(totalDropPerUnlockedToken,weiPerToken); //account for locked tokens and add the drop
		Payout(weiPerToken);
	}
    
    function getUnlockedTokens() constant returns (uint) {
        return unlockedTokens;
    }
    
    function claimBonus() {
        Account storage account = getAccount(msg.sender, UpdateMode.Wei);
        uint sendValue = account.bonusWei; //fetch the values
        if(sendValue != 0){
            account.bonusWei = 0;           //set to zero (before against reentry) 
            msg.sender.transfer(sendValue); //send the bonus to the correct account
        }
    }
    
    function totalSupply() constant returns (uint) {
        return safeAdd(unlockedTokens,lockedTokens);
    }
    
    function balanceOf(address _owner) constant returns (uint balance) {
        return accounts[_owner].valueMod;
    }
    
    function isVoteOngoing() internal returns (bool)  {
        return currentProposal.valueMod != 0 && block.number >= currentProposal.startBlockNr && block.number < currentProposal.startBlockNr + votingDurationBlocks;
    }
    
	function getAccount(address _addr, UpdateMode mode) internal returns(Account storage){        
        Account storage account = accounts[_addr];
		if(mode == UpdateMode.Vote || mode == UpdateMode.Both){
		    if(isVoteOngoing() && account.lastProposalStartBlockNr < currentProposal.startBlockNr) { // the user did set his token power yet
                account.valueModVote = account.valueMod;
                account.lastProposalStartBlockNr = currentProposal.startBlockNr;
            }
		}
		
		if(mode == UpdateMode.Wei || mode == UpdateMode.Both){
            uint bonus = safeSub(totalDropPerUnlockedToken,account.lastAirdropWei);
            if(bonus != 0){
    			account.bonusWei = safeAdd(account.bonusWei ,safeMul(bonus,account.valueMod));
    			account.lastAirdropWei = totalDropPerUnlockedToken;
    		}
		}
		
		return account;
    }
    
    function transfer(address _to, uint _value) returns (bool success) {
        require(mintDone);
        Account storage tmpFrom = getAccount(msg.sender, UpdateMode.None);
        if (tmpFrom.valueMod >= _value  && _value > 0){
                Account storage from = getAccount(msg.sender, UpdateMode.Both);
                Account storage to = getAccount(_to, UpdateMode.Both);
                from.valueMod = safeSub(from.valueMod,_value);
                to.valueMod = safeAdd(to.valueMod,_value);
                Transfer(msg.sender, _to, _value);
                return true;
        } 
        return false;
    }
    
    function transferFrom(address _from, address _to, uint _value) returns (bool success) {
        require(mintDone);
        Account storage tmpFrom = getAccount(msg.sender, UpdateMode.None);
        if (tmpFrom.valueMod >= _value  && _value > 0 && allowed[_from][msg.sender] >= _value){
                Account storage from = getAccount(msg.sender, UpdateMode.Both);
                Account storage to = getAccount(_to, UpdateMode.Both);
                from.valueMod = safeSub(from.valueMod,_value);
                to.valueMod = safeAdd(to.valueMod ,_value);
                allowed[_from][msg.sender] = safeSub(allowed[_from][msg.sender],_value);
                Transfer(msg.sender, _to, _value);
                return true;
        } 
        return false;
    }
    
    function approve(address _spender, uint _value) returns (bool success) {
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }
    
    function allowance(address _owner, address _spender) constant returns (uint remaining) {
        return allowed[_owner][_spender];
    }

    //************************* SafeMath ************************************
    //From SafeMath found in https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/math/SafeMath.sol
    //removed it as a library function for better readability
    function safeMul(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }

    function safeDiv(uint256 a, uint256 b) internal constant returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    function safeSub(uint256 a, uint256 b) internal constant returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    function safeAdd(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}


