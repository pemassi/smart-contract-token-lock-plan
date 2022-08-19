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

    // Lock Plan
    mapping(address => LockPlan[]) public lockPlans;
    mapping(address => uint256) public lockPlanLengths;

    // Token Balance
    mapping(address => uint256) public balances;
    mapping(address => uint256) public alreadyWithdrawn;
    uint256 public totalBalance;
    uint256 public contractEthBalance;

    // Lock Timestamp
    uint256 public lockStartTimestamp;

    // Lock ERC20 Contract
    IERC20 public erc20Contract;

    // Events
    event EthDeposited(address from, uint256 amount);
    event TokensLocked(address recipient, uint256 amount);
    event TokensWithdrawed(address recipient, uint256 amount);

    /// @dev Deploys contract and links the ERC20 token which we are locking.
    /// @param _erc20_contract_address, the ERC20 token address that we are locking
    constructor(IERC20 _erc20_contract_address) {
        // Allow this contract's owner to make deposits by setting allIncomingDepositsFinalised to false
        isLocked = false;

        // Set contract owner
        owner = payable(msg.sender);

        // Set the erc20 contract address which this timelock is deliberately paired to
        require(address(_erc20_contract_address) != address(0), "_erc20_contract_address address can not be zero");
        erc20Contract = _erc20_contract_address;
    }

    /// @dev the plan should be locked
    modifier locked() {
        require(isLocked == true, "Plan is not locked yet.");
        _;
    }

    /// @dev the plan should be unlocked
    modifier notLocked() {
        require(isLocked == false, "Plan is locked.");
        _;
    }

    /// @dev only owner can call
    modifier onlyOwner() {
        require(msg.sender == owner, "Message sender must be the contract's owner.");
        _;
    }

    receive() payable external notLocked {
        /// Tracking accidently deposited ETH for later
        contractEthBalance = contractEthBalance.add(msg.value);
        emit EthDeposited(msg.sender, msg.value);
    }

    /// @dev Lockup the Plan
    /// This will lockup the plan, and the owner will not able to transfer the target token anymore.
    /// The owner can only transfer the target token that excceed total balance of lock plan.
    function lockup() public onlyOwner notLocked {
        // Check contract balance is equal to all locked token amount.
        require(erc20Contract.balanceOf(address(this)) >= totalBalance, "Depoisted contract balance is less than total locking amount.");

        // Record Lock Start Time
        lockStartTimestamp = block.timestamp;

        // Make owner cannot access anymore
        isLocked = true;
    }

    /// @dev Set the Lock Plan for recipient.
    /// The original lock plan of recipient will be replaced by this new plan.
    /// @param recipient, the address of recipient
    /// @param unlockAfterSecs, the seconds to unlock after the lock (in secs)
    /// @param lockAmounts, amount of locking token
    function setLockPlan(address recipient, uint256[] calldata unlockAfterSecs, uint256[] calldata lockAmounts) public onlyOwner notLocked {
        require(recipient != address(0), "ERC20: transfer to the zero address.");
        require(unlockAfterSecs.length == lockAmounts.length, "The unlockAfterSecs and lockAmounts must be the same length.");
        
        // Delete the original lock plan
        delete lockPlans[recipient];

        for(uint256 i = 0; i < unlockAfterSecs.length; i++)
        {
            uint256 unlockAfterSec = unlockAfterSecs[i];
            uint256 lockAmount = lockAmounts[i];

            // Add lock plan
            lockPlans[recipient].push(
                LockPlan(
                    lockAmount,
                    unlockAfterSec
                )
            );
            lockPlanLengths[recipient] = lockPlanLengths[recipient].add(1);

            // Track lock balance
            balances[recipient] = balances[recipient].add(lockAmount);
            totalBalance = totalBalance.add(lockAmount);

            emit TokensLocked(recipient, lockAmount);
        }
    }

    /// @dev Set the Lock Plans for many recipient.
    /// The original lock plan of recipient will be replaced by this new plan.
    /// @param recipients, the address of recipient
    /// @param unlockAfterSecss, the seconds to unlock after the lock (in secs)
    /// @param lockAmountss, amount of locking token
    function bulkSetLockPlan(address[] calldata recipients, uint256[][] calldata unlockAfterSecss, uint256[][] calldata lockAmountss) external onlyOwner notLocked {
        require(recipients.length == unlockAfterSecss.length && unlockAfterSecss.length == lockAmountss.length, "The recipients, unlockAfterSecss and lockAmountss must be the same length.");
        
        for(uint256 i = 0; i < recipients.length; i++)
        {
            setLockPlan(recipients[i], unlockAfterSecss[i], lockAmountss[i]);
        }
    }

    /// @dev Check how many tokens has been unlocked for recipient.
    /// @param recipient, the address of recipient
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

    /// @dev Withdraw unlocked token of recipient
    /// @param recipient, the address of recipient
    /// @param withdrawAmount, the amount of withdrawing token (in wei)
    function withdrawUnlockedToken(address recipient, uint256 withdrawAmount) public nonReentrant locked {
        // Validate
        require(recipient != address(0), "ERC20: transfer to the zero address");
        require(erc20Contract.balanceOf(address(this)) >= withdrawAmount, "Insufficient contract's token balance, try lesser amount");
        require(balances[recipient] >= withdrawAmount, "Insufficient recipient's token balance, try lesser amount");
        require(msg.sender == recipient, "Only the token recipient can perform the unlock");

        // Calculate unlocked token balance
        uint256 unlockedBalance = checkUnlockedTokenBalance(recipient);
        
        // Calaculate withdrawable token balance
        uint256 withdrawableAmount = unlockedBalance.sub(alreadyWithdrawn[recipient]);
        require(withdrawableAmount >= withdrawAmount, "Some tokens are still locked, try lesser amount.");

        // Transfer
        alreadyWithdrawn[recipient] = alreadyWithdrawn[recipient].add(withdrawAmount);
        balances[recipient] = balances[recipient].sub(withdrawAmount);
        totalBalance = totalBalance.sub(withdrawAmount);
        erc20Contract.safeTransfer(recipient, withdrawAmount);
        emit TokensWithdrawed(recipient, withdrawAmount);
    }

    /// @dev Get balance of deposited ETH into this contract.
    function depositedEthBalance() public view returns (uint256) {
        return erc20Contract.balanceOf(address(this));
    }

    /// @dev Transfer deposited tokens before lockup to onwer.
    /// @param amount, amount of ERC20 tokens to remove.
    function transferDepositedTokens(uint256 amount) public onlyOwner nonReentrant notLocked {
        erc20Contract.safeTransfer(owner, amount);
    }

    /// @dev Transfer accidentally deposited tokens before lockup to onwer.
    /// @param amount, amount of ERC20 tokens to remove.
    function transferAccidentallyDepositedTokens(uint256 amount) public onlyOwner nonReentrant locked {
        require(erc20Contract.balanceOf(address(this)) > totalBalance, "There is no more accidentally deposited tokens.");
        require(erc20Contract.balanceOf(address(this)).sub(totalBalance) < amount, "The amount that try to transfer is bigger than accidentally deposited amount.");

        erc20Contract.safeTransfer(owner, amount);
    }

    /// @dev Transfer accidentally deposited other ERC20 tokens to onwer.
    /// @param token, other ERC20 token contract address.
    /// @param amount, amount of ERC20 tokens to remove.
    function transferAccidentallyDepositedOtherTokens(IERC20 token, uint256 amount) public onlyOwner nonReentrant {
        // Validate
        require(address(token) != address(0), "Token address can not be zero.");
        require(token != erc20Contract, "Only token which is not locked by this contract can be transfered.");
        
        token.safeTransfer(owner, amount);
    }

    /// @dev Transfer accidently deposited ETH to onwer.
    /// @param amount, of network tokens to withdraw (in wei).
    function transferAccidentallyDepositedEth(uint256 amount) public onlyOwner nonReentrant{
        require(amount <= contractEthBalance, "Insufficient funds");
        contractEthBalance = contractEthBalance.sub(amount);

        // Transfer the specified amount of Eth to the owner of this contract
        owner.transfer(amount);
    }
}