// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "openzeppelin-solidity/contracts/utils/math/SafeMath.sol";

contract TokenLockPlan is ReentrancyGuard {

    struct LockPlan {
        uint256 amount;
        uint256 unlockAfterSecs;
    }

    // Flags
    bool public isLocked;

    // Library usage
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Contract owner
    address payable public owner;

    // Token amount variables
    mapping(address => LockPlan[]) public lockPlans;
    mapping(address => uint256) public lockPlanLengths;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public alreadyWithdrawn;
    uint256 public totalBalance;
    uint256 public contractEthBalance;
    uint256 public lockStartTimestamp;

    // ERC20 contract address
    IERC20 public erc20Contract;

    // Events
    event TokensDeposited(address from, uint256 amount);
    event AllocationPerformed(address recipient, uint256 amount);
    event TokensUnlocked(address recipient, uint256 amount);

    /// @dev Deploys contract and links the ERC20 token which we are timelocking, also sets owner as msg.sender and sets timestampSet bool to false.
    /// @param _erc20_contract_address.
    constructor(IERC20 _erc20_contract_address) {
        // Allow this contract's owner to make deposits by setting allIncomingDepositsFinalised to false
        isLocked = false;

        // Set contract owner
        owner = payable(msg.sender);

        // Set the erc20 contract address which this timelock is deliberately paired to
        require(address(_erc20_contract_address) != address(0), "_erc20_contract_address address can not be zero");
        erc20Contract = _erc20_contract_address;
    }

    modifier locked() {
        require(isLocked == true, "Plan is not locked yet.");
        _;
    }

    modifier notLocked() {
        require(isLocked == false, "Plan is locked.");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Message sender must be the contract's owner.");
        _;
    }

    receive() payable external notLocked {
        contractEthBalance = contractEthBalance.add(msg.value);
        emit TokensDeposited(msg.sender, msg.value);
    }

    /// @dev Takes away any ability (for the contract owner) to assign any tokens to any recipients. 
    /// This function is only to be called by the contract owner. 
    /// Calling this function can not be undone. 
    /// Calling this function must only be performed when all of the addresses and amounts are allocated (to the recipients). 
    /// This function finalizes the contract owners involvement and at this point the contract's timelock functionality is non-custodial
    function lockup() public onlyOwner notLocked {
        // Check contract balance is equal to all locked token amount.
        require(erc20Contract.balanceOf(address(this)) >= totalBalance, "Depoisted contract balance is less than total locking amount.");

        // Record Lock Start Time
        lockStartTimestamp = block.timestamp;

        // Make owner cannot access anymore
        isLocked = true;
    }

    /// @dev 
    /// @param recipient, address of recipient.
    /// @param unlockTimestamps, timestamp when token is unlocked
    /// @param amounts, amount of locking token
    function setLockPlan(address recipient, uint256[] calldata unlockTimestamps, uint256[] calldata amounts) public onlyOwner notLocked {
        require(recipient != address(0), "ERC20: transfer to the zero address.");
        require(unlockTimestamps.length == amounts.length, "The unlockTimestamps and amounts must be the same length.");
        
        delete lockPlans[recipient];

        for(uint256 i = 0; i < unlockTimestamps.length; i++)
        {
            uint256 unlockTimestamp = unlockTimestamps[i];
            uint256 amount = amounts[i];

            lockPlans[recipient].push(
                LockPlan(
                    amount,
                    unlockTimestamp
                )
            );
            lockPlanLengths[recipient] = lockPlanLengths[recipient].add(1);
            balances[recipient] = balances[recipient].add(amount);
            totalBalance = totalBalance.add(amount);

            emit AllocationPerformed(recipient, amount);
        }
    }

    /// @dev 
    /// @param recipients, an array of addresses of the many recipient.
    /// @param unlockTimestampss, timestamp when token is unlocked
    /// @param amountss to allocate to each of the many recipient.
    function bulkSetLockPlan(address[] calldata recipients, uint256[][] calldata unlockTimestampss, uint256[][] calldata amountss) external onlyOwner notLocked {
        require(recipients.length == unlockTimestampss.length && unlockTimestampss.length == amountss.length, "The recipients, unlockTimestampss and amountss must be the same length.");
        
        for(uint256 i = 0; i < recipients.length; i++)
        {
            setLockPlan(recipients[i], unlockTimestampss[i], amountss[i]);
        }
    }

    function checkUnlockedTokenBalance(address recipient) public locked view returns (uint256) {
        // Calculate unlocked token balance
        uint256 unlockedBalance = 0;
        for(uint256 i = 0; i < lockPlans[recipient].length; i++)
        {
            uint256 amount = lockPlans[recipient][i].amount;
            uint256 unlockAfterSecs = lockPlans[recipient][i].unlockAfterSecs;

            if(block.timestamp >= lockStartTimestamp + unlockAfterSecs)
            {
                unlockedBalance = unlockedBalance.add(amount);
            }
        }

        return unlockedBalance;
    }

    /// @dev Allows recipient to unlock tokens after 24 month period has elapsed
    /// @param recipient - the recipient's account address.
    /// @param withdrawAmount - the amount to unlock (in wei)
    function withdrawUnlockedToken(address recipient, uint256 withdrawAmount) public nonReentrant locked {
        // Validate
        require(recipient != address(0), "ERC20: transfer to the zero address");
        //require(erc20Contract.balanceOf(address(this)) >= withdrawAmount, "Insufficient token balance (contract), try lesser amount");
        require(balances[recipient] >= withdrawAmount, "Insufficient token balance (user), try lesser amount");
        require(msg.sender == recipient, "Only the token recipient can perform the unlock");

        // Calculate unlocked token balance
        uint256 unlockedBalance = checkUnlockedTokenBalance(recipient);
        
        // Validate
        uint256 withdrawableAmount = unlockedBalance.sub(alreadyWithdrawn[recipient]);
        require(withdrawableAmount >= withdrawAmount, "Some tokens are still locked, try lesser amount.");

        // Transfer
        alreadyWithdrawn[recipient] = alreadyWithdrawn[recipient].add(withdrawAmount);
        balances[recipient] = balances[recipient].sub(withdrawAmount);
        totalBalance = totalBalance.sub(withdrawAmount);
        emit TokensUnlocked(recipient, withdrawAmount);

        erc20Contract.safeTransfer(recipient, withdrawAmount);
    }

    function depositedTokenBalance() public view returns (uint256) {
        return erc20Contract.balanceOf(address(this));
    }

    /// @dev Transfer accidentally deposited tokens before lockup.
    /// @param amount of ERC20 tokens to remove.
    function transferAccidentallyDepositedTokens(uint256 amount) public onlyOwner nonReentrant notLocked {
        erc20Contract.safeTransfer(owner, amount);
    }

    /// @dev Transfer accidentally deposited ERC20 tokens.
    /// @param token - ERC20 token address.
    /// @param amount of ERC20 tokens to remove.
    function transferAccidentallyDepositedOtherTokens(IERC20 token, uint256 amount) public onlyOwner nonReentrant {
        // Validate
        require(address(token) != address(0), "Token address can not be zero.");
        require(token != erc20Contract, "Only token which is not locked by this contract can be transfered.");
        
        token.safeTransfer(owner, amount);
    }

    /// @dev Transfer Eth in case Eth is accidently sent to this contract.
    /// @param amount of network tokens to withdraw (in wei).
    function transferAccidentallyDepositedEth(uint256 amount) public onlyOwner nonReentrant{
        require(amount <= contractEthBalance, "Insufficient funds");
        contractEthBalance = contractEthBalance.sub(amount);

        // Transfer the specified amount of Eth to the owner of this contract
        owner.transfer(amount);
    }
}