const { time, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { PlanHelper } = require("../helper/plan.helper");
const TokenLockPlan = artifacts.require("TokenLockPlan");
const TestToken = artifacts.require("TestToken");
const { expect } = require('chai');
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

contract("TokenLockPlan", (accounts) => {
  // Instance
  let planInstance;
  let tokenInstance;

  // Accounts
  let owner = accounts[0];
  let user1 = accounts[1];
  let user2 = accounts[2];

  // Tx
  let txOwner = {from: owner};
  let txUser1 = {from: user1};
  let txUser2 = {from: user2};

  // Const
  const TOKEN_MAX_BALANCE = 1_000_000_000;

  beforeEach(async () => {
    tokenInstance = await TestToken.new(1_000_000_000, txOwner);
    planInstance = await TokenLockPlan.new(tokenInstance.address, txOwner);
  });

  describe("Test Constructor", () => {
    it("isLocked should be false", async () => {
      assert.equal(await planInstance.isLocked(), false);
    });
  });


  describe("Test Method: setLockPlan", () => {

    it("Throw when unlockTimestamps and amounts sizes are not equal", async () => {
      await expectRevert(
        planInstance.setLockPlan(user1, [1], []),
        "unlockAfterSecs and lockAmounts must be the same length"
      )

      await expectRevert(
        planInstance.setLockPlan(user1, [], [1]),
        "unlockAfterSecs and lockAmounts must be the same length"
      )
    });

    it("Throw when called by not owner", async () => {
      await expectRevert(
        planInstance.setLockPlan(user1, [1], [1], {from: user1}),
        "Ownable: caller is not the owner"
      )
    });

    it("Throw when try to set plan after locked", async () => {
      await planInstance.lockup();
      await expectRevert(
        planInstance.lockup(),
        "Plan is locked"
      )
    });

    it("Should be added", async () => {
      // Add Lock Plan
      await planInstance.setLockPlan(user1, [10, 20],  [1, 2])
      await planInstance.setLockPlan(user2, [30, 40],  [3, 4])

      // Check Added (user1)
      let lockPlanLength = await planInstance.lockPlanLength.call(user1);
      expect(lockPlanLength.toNumber()).to.equal(2);

      let lockPlan1 = await planInstance.lockPlans.call(user1, 0)
      assert.equal(lockPlan1[0].toNumber(), 1);
      assert.equal(lockPlan1[1].toNumber(), 10);

      let lockPlan2 = await planInstance.lockPlans.call(user1, 1)
      assert.equal(lockPlan2[0].toNumber(), 2);
      assert.equal(lockPlan2[1].toNumber(), 20);

      // Check Added (user2)
      let lockPlanLength2 = await planInstance.lockPlanLength.call(user2);
      assert.equal(lockPlanLength2, 2);

      let lockPlan21 = await planInstance.lockPlans.call(user2, 0)
      assert.equal(lockPlan21[0].toNumber(), 3);
      assert.equal(lockPlan21[1].toNumber(), 30);

      let lockPlan22 = await planInstance.lockPlans.call(user2, 1)
      assert.equal(lockPlan22[0].toNumber(), 4);
      assert.equal(lockPlan22[1].toNumber(), 40);
    });
  });

  describe("Test Method: bulkSetLockPlan", () => {
    it("Throw when recipients, unlockTimestampss and amountss sizes are not equal", async () => {
      await expectRevert(
        planInstance.bulkSetLockPlan([user1], [[1]], []),
        "recipients, unlockAfterSecss and lockAmountss must be the same length"
      )

      await expectRevert(
        planInstance.bulkSetLockPlan([user1], [], [[1]]),
        "recipients, unlockAfterSecss and lockAmountss must be the same length"
      )

      await expectRevert(
        planInstance.bulkSetLockPlan([], [[1]], [[1]]),
        "recipients, unlockAfterSecss and lockAmountss must be the same length"
      )
    });

    it("Throw when called by not owner", async () => {
      await expectRevert(
        planInstance.bulkSetLockPlan([user1], [[1]], [[1]], {from: user1}),
        "Ownable: caller is not the owner"
      )
    });

    it("Should be added", async () => {
      // Add Lock Plan
      await planInstance.bulkSetLockPlan([user1, user2], [[10, 20], [30, 40]], [[1, 2], [3, 4]])

      // Check Added (user1)
      let lockPlanLength = await planInstance.lockPlanLength.call(user1);
      assert.equal(lockPlanLength, 2);

      let lockPlan1 = await planInstance.lockPlans.call(user1, 0)
      assert.equal(lockPlan1[0].toNumber(), 1);
      assert.equal(lockPlan1[1].toNumber(), 10);

      let lockPlan2 = await planInstance.lockPlans.call(user1, 1)
      assert.equal(lockPlan2[0].toNumber(), 2);
      assert.equal(lockPlan2[1].toNumber(), 20);

      // Check Added (user2)
      let lockPlanLength2 = await planInstance.lockPlanLength.call(user2);
      assert.equal(lockPlanLength2, 2);

      let lockPlan21 = await planInstance.lockPlans.call(user2, 0)
      assert.equal(lockPlan21[0].toNumber(), 3);
      assert.equal(lockPlan21[1].toNumber(), 30);

      let lockPlan22 = await planInstance.lockPlans.call(user2, 1)
      assert.equal(lockPlan22[0].toNumber(), 4);
      assert.equal(lockPlan22[1].toNumber(), 40);
    });
  });

  describe("Test Method: userUnlockedTokenBalance", () => {
    it("Should be zero", async () => {
      // Lockup
      await planInstance.lockup()

      let amount = await planInstance.userUnlockedTokenBalance.call(user1);
      assert.equal(amount.toNumber(), 0);

      let amount2 = await planInstance.userUnlockedTokenBalance.call(user2);
      assert.equal(amount2.toNumber(), 0);
    });

    it("Should be all unlocked after some times", async () => {
      // Add Lock Plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);
      await planInstance.setLockPlan(user2, [0, 100], [30, 40]);

      // Deposit
      await tokenInstance.transfer(planInstance.address, 100);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 100);

      // Lockup
      await planInstance.lockup()

      // Compare
      expect((await planInstance.userUnlockedTokenBalance.call(user1)).toNumber()).to.equal(10);
      expect((await planInstance.userUnlockedTokenBalance.call(user2)).toNumber()).to.equal(30);

      // Wait
      await time.increase(time.duration.seconds(100));

      // Compare
      expect((await planInstance.userUnlockedTokenBalance.call(user1)).toNumber()).to.equal(30);
      expect((await planInstance.userUnlockedTokenBalance.call(user2)).toNumber()).to.equal(70);
    });
  });

  describe("Test Method: myUnlockedTokenBalance", () => {
    it("Should be zero", async () => {
      // Lockup
      await planInstance.lockup()

      let amount = await planInstance.myUnlockedTokenBalance.call(txUser1);
      assert.equal(amount.toNumber(), 0);

      let amount2 = await planInstance.myUnlockedTokenBalance.call(txUser2);
      assert.equal(amount2.toNumber(), 0);
    });

    it("Should be all unlocked after some times", async () => {
      // Add Lock Plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);
      await planInstance.setLockPlan(user2, [0, 100], [30, 40]);

      // Deposit
      await tokenInstance.transfer(planInstance.address, 100);
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), TOKEN_MAX_BALANCE - 100);

      // Lockup
      await planInstance.lockup()

      // Compare
      expect((await planInstance.myUnlockedTokenBalance.call(txUser1)).toNumber()).to.equal(10);
      expect((await planInstance.myUnlockedTokenBalance.call(txUser2)).toNumber()).to.equal(30);

      // Wait
      await time.increase(time.duration.seconds(100));

      // Compare
      expect((await planInstance.myUnlockedTokenBalance.call(txUser1)).toNumber()).to.equal(30);
      expect((await planInstance.myUnlockedTokenBalance.call(txUser2)).toNumber()).to.equal(70);
    });
  });

  describe("Test Method: withdrawMyUnlockedToken", () => {

    it("Throw when plan is not locked", async () => {
      await expectRevert(planInstance.withdrawMyUnlockedToken(0), "Plan is unlocked");
    })

    it("Throw when contract balance is insufficient", async () => {
      await planInstance.lockup();
      await expectRevert(planInstance.withdrawMyUnlockedToken(10), "Insufficient contract balance");
    })

    it("Throw when recipient balance is insufficient", async () => {
      await planInstance.lockup();
      await tokenInstance.transfer(planInstance.address, 10);
      await expectRevert(planInstance.withdrawMyUnlockedToken(10), "Insufficient recipient balance");
    })

    it("Throw when tokens are still locked", async () => {
      // Set Plan
      await planInstance.setLockPlan(user1, [100], [10]);

      // Transfer Token
      await tokenInstance.transfer(planInstance.address, 10);

      // Lockup
      await planInstance.lockup()

      // Withdraw
      await expectRevert(
        planInstance.withdrawMyUnlockedToken(10, txUser1),
        "Amount excceed unlocked balance"
      )
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 0);
      assert.equal((await planInstance.balances(user1)).toNumber(), 10);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 0);
      assert.equal((await planInstance.totalBalance()).toNumber(), 10);
    });

    it("Should be able to witrhdraw", async () => {
      // Set Plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);

      // Transfer Token
      await tokenInstance.transfer(planInstance.address, 30);

      // Lockup
      await planInstance.lockup()

      // Withdraw - 1
      await planInstance.withdrawMyUnlockedToken(10, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);
    });

    it("Should be able to witrhdraw in parts", async () => {
      // Set plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);

      // Transfer
      await tokenInstance.transfer(planInstance.address, 30);

      // Lockup
      await planInstance.lockup()

      // Withdraw - 1
      await planInstance.withdrawMyUnlockedToken(5, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 5);
      assert.equal((await planInstance.balances(user1)).toNumber(), 25);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 5);
      assert.equal((await planInstance.totalBalance()).toNumber(), 25);

      // Withdraw - 2
      await planInstance.withdrawMyUnlockedToken(5, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);
    });

    it("Should be able to witrhdraw some tokens and throw when some tokens are still locked", async () => {
      // Set plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);

      // Transfer
      await tokenInstance.transfer(planInstance.address, 30);

      // Lockup
      await planInstance.lockup()

      // Withdraw - Over amount
      await expectRevert(
        planInstance.withdrawMyUnlockedToken(20, txUser1),
        "Amount excceed unlocked balance"
      )
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 0);
      assert.equal((await planInstance.balances(user1)).toNumber(), 30);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 0);
      assert.equal((await planInstance.totalBalance()).toNumber(), 30);
      
      // Withrdraw - Exact Amount
      await planInstance.withdrawMyUnlockedToken(10, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);
    });

    it("Should be able to witrhdraw after passed timestamp", async () => {
      // Add Plan
      await planInstance.setLockPlan(user1, [100, 200], [10, 10]);

      // Deposit
      await tokenInstance.transfer(planInstance.address, 20);

      // Lockup
      await planInstance.lockup()

      // Before Unlock Time
      await expectRevert(
        planInstance.withdrawMyUnlockedToken(10, txUser1),
        "Amount excceed unlocked balance"
      );
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 0);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 0);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);

      // Wait
      await time.increase(time.duration.seconds(100));

      // After Unlock Time
      await planInstance.withdrawMyUnlockedToken(10, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 10);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 10);

      // Wait
      await time.increase(time.duration.seconds(100));

      // After Unlock Time
      await planInstance.withdrawMyUnlockedToken(10, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 20);
      assert.equal((await planInstance.balances(user1)).toNumber(), 0);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 20);
      assert.equal((await planInstance.totalBalance()).toNumber(), 0);
    });

    it("Should be able to witrhdraw for multipleUser (complex testing)", async () => {
      // Set Plan
      await planInstance.setLockPlan(user1, [0, 50], [10, 20]);
      await planInstance.setLockPlan(user2, [0, 100], [30, 40]);

      // Transfer Token
      await tokenInstance.transfer(planInstance.address, 100);

      // Lockup
      await planInstance.lockup()

      // Withdraw - user1
      await planInstance.withdrawMyUnlockedToken(10, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 90);

      // Withdraw - user2
      await planInstance.withdrawMyUnlockedToken(30, txUser2);
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 30);
      assert.equal((await planInstance.balances(user2)).toNumber(), 40);
      assert.equal((await planInstance.alreadyWithdrawn(user2)).toNumber(), 30);
      assert.equal((await planInstance.totalBalance()).toNumber(), 60);

      // Wait
      await time.increase(time.duration.seconds(50));

      // Withdraw - user1
      await planInstance.withdrawMyUnlockedToken(20, txUser1);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 30);
      assert.equal((await planInstance.balances(user1)).toNumber(), 0);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 30);
      assert.equal((await planInstance.totalBalance()).toNumber(), 40);

      // Before Unlock Time
      await expectRevert(
        planInstance.withdrawMyUnlockedToken(40, txUser2),
        "Amount excceed unlocked balance"
      );
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 30);
      assert.equal((await planInstance.balances(user2)).toNumber(), 40);
      assert.equal((await planInstance.alreadyWithdrawn(user2)).toNumber(), 30);
      assert.equal((await planInstance.totalBalance()).toNumber(), 40);

      // Wait
      await time.increase(time.duration.seconds(50));

      // Withdraw - user2
      await planInstance.withdrawMyUnlockedToken(40, txUser2);
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 70);
      assert.equal((await planInstance.balances(user2)).toNumber(), 0);
      assert.equal((await planInstance.alreadyWithdrawn(user2)).toNumber(), 70);
      assert.equal((await planInstance.totalBalance()).toNumber(), 0);
    });
  });

  describe("Test Method: withdrawUserUnlockedToken", () => {

    it("Throw when sender is not owner", async () => {
      await expectRevert(planInstance.withdrawUserUnlockedToken(owner, 0, txUser1), "Ownable: caller is not the owner");
    });

    it("Throw when plan is not locked", async () => {
      await expectRevert(planInstance.withdrawUserUnlockedToken(owner, 0), "Plan is unlocked");
    });

    it("Throw when contract balance is insufficient", async () => {
      await planInstance.lockup();
      await expectRevert(planInstance.withdrawUserUnlockedToken(owner, 10), "Insufficient contract balance");
    })

    it("Throw when recipient balance is insufficient", async () => {
      await planInstance.lockup();
      await tokenInstance.transfer(planInstance.address, 10);
      await expectRevert(planInstance.withdrawUserUnlockedToken(owner, 10), "Insufficient recipient balance");
    })

    it("Throw when tokens are still locked", async () => {
      // Set Plan
      await planInstance.setLockPlan(user1, [100], [10]);

      // Transfer Token
      await tokenInstance.transfer(planInstance.address, 10);

      // Lockup
      await planInstance.lockup()

      // Withdraw
      await expectRevert(
        planInstance.withdrawUserUnlockedToken(user1, 10),
        "Amount excceed unlocked balance"
      )
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 0);
      assert.equal((await planInstance.balances(user1)).toNumber(), 10);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 0);
      assert.equal((await planInstance.totalBalance()).toNumber(), 10);
    });

    it("Should be able to witrhdraw", async () => {
      // Set Plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);

      // Transfer Token
      await tokenInstance.transfer(planInstance.address, 30);

      // Lockup
      await planInstance.lockup()

      // Withdraw - 1
      await planInstance.withdrawUserUnlockedToken(user1, 10);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);
    });

    it("Should be able to witrhdraw in parts", async () => {
      // Set plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);

      // Transfer
      await tokenInstance.transfer(planInstance.address, 30);

      // Lockup
      await planInstance.lockup()

      // Withdraw - 1
      await planInstance.withdrawUserUnlockedToken(user1, 5);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 5);
      assert.equal((await planInstance.balances(user1)).toNumber(), 25);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 5);
      assert.equal((await planInstance.totalBalance()).toNumber(), 25);

      // Withdraw - 2
      await planInstance.withdrawUserUnlockedToken(user1, 5);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);
    });

    it("Should be able to witrhdraw some tokens and throw when some tokens are still locked", async () => {
      // Set plan
      await planInstance.setLockPlan(user1, [0, 100], [10, 20]);

      // Transfer
      await tokenInstance.transfer(planInstance.address, 30);

      // Lockup
      await planInstance.lockup()

      // Withdraw - Over amount
      await expectRevert(
        planInstance.withdrawUserUnlockedToken(user1, 20),
        "Amount excceed unlocked balance"
      )
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 0);
      assert.equal((await planInstance.balances(user1)).toNumber(), 30);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 0);
      assert.equal((await planInstance.totalBalance()).toNumber(), 30);
      
      // Withrdraw - Exact Amount
      await planInstance.withdrawUserUnlockedToken(user1, 10);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);
    });

    it("Should be able to witrhdraw after passed timestamp", async () => {
      // Add Plan
      await planInstance.setLockPlan(user1, [100, 200], [10, 10]);

      // Deposit
      await tokenInstance.transfer(planInstance.address, 20);

      // Lockup
      await planInstance.lockup()

      // Before Unlock Time
      await expectRevert(
        planInstance.withdrawUserUnlockedToken(user1, 10),
        "Amount excceed unlocked balance"
      );
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 0);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 0);
      assert.equal((await planInstance.totalBalance()).toNumber(), 20);

      // Wait
      await time.increase(time.duration.seconds(100));

      // After Unlock Time
      await planInstance.withdrawUserUnlockedToken(user1, 10);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 10);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 10);

      // Wait
      await time.increase(time.duration.seconds(100));

      // After Unlock Time
      await planInstance.withdrawUserUnlockedToken(user1, 10);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 20);
      assert.equal((await planInstance.balances(user1)).toNumber(), 0);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 20);
      assert.equal((await planInstance.totalBalance()).toNumber(), 0);
    });

    it("Should be able to witrhdraw for multipleUser (complex testing)", async () => {
      // Set Plan
      await planInstance.setLockPlan(user1, [0, 50], [10, 20]);
      await planInstance.setLockPlan(user2, [0, 100], [30, 40]);

      // Transfer Token
      await tokenInstance.transfer(planInstance.address, 100);

      // Lockup
      await planInstance.lockup()

      // Withdraw - user1
      await planInstance.withdrawUserUnlockedToken(user1, 10);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.totalBalance()).toNumber(), 90);

      // Withdraw - user2
      await planInstance.withdrawUserUnlockedToken(user2, 30);
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 30);
      assert.equal((await planInstance.balances(user2)).toNumber(), 40);
      assert.equal((await planInstance.alreadyWithdrawn(user2)).toNumber(), 30);
      assert.equal((await planInstance.totalBalance()).toNumber(), 60);

      // Wait
      await time.increase(time.duration.seconds(50));

      // Withdraw - user1
      await planInstance.withdrawUserUnlockedToken(user1, 20);
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 30);
      assert.equal((await planInstance.balances(user1)).toNumber(), 0);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 30);
      assert.equal((await planInstance.totalBalance()).toNumber(), 40);

      // Before Unlock Time
      await expectRevert(
        planInstance.withdrawUserUnlockedToken(user2, 40),
        "Amount excceed unlocked balance"
      );
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 30);
      assert.equal((await planInstance.balances(user2)).toNumber(), 40);
      assert.equal((await planInstance.alreadyWithdrawn(user2)).toNumber(), 30);
      assert.equal((await planInstance.totalBalance()).toNumber(), 40);

      // Wait
      await time.increase(time.duration.seconds(50));

      // Withdraw - user2
      await planInstance.withdrawUserUnlockedToken(user2, 40);
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 70);
      assert.equal((await planInstance.balances(user2)).toNumber(), 0);
      assert.equal((await planInstance.alreadyWithdrawn(user2)).toNumber(), 70);
      assert.equal((await planInstance.totalBalance()).toNumber(), 0);
    });

  });

  describe("Test Method: withdrawAllUserUnlockedToken", () => {

    it("Throw when sender is not owner", async () => {
      await expectRevert(planInstance.withdrawAllUserUnlockedToken(txUser1), "Ownable: caller is not the owner");
    });

    it("Throw when plan is not locked", async () => {
      await expectRevert(planInstance.withdrawAllUserUnlockedToken(), "Plan is unlocked");
    });

    it("Should be successfully withdraw all users token", async () => {
      //given
      // Set Plan
      await planInstance.setLockPlan(user1, [0, 50], [10, 20]);
      await planInstance.setLockPlan(user2, [0, 100], [30, 40]);

      // Transfer Token
      await tokenInstance.transfer(planInstance.address, 100);

      // Lockup
      await planInstance.lockup()

      //when - 1
      await planInstance.withdrawAllUserUnlockedToken();

      //then - 1
      //plan
      assert.equal((await planInstance.totalBalance()).toNumber(), 60);

      //user1
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 10);
      assert.equal((await planInstance.alreadyWithdrawn(user1)).toNumber(), 10);
      assert.equal((await planInstance.balances(user1)).toNumber(), 20);

      //user2
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 30);
      assert.equal((await planInstance.alreadyWithdrawn(user2)).toNumber(), 30);
      assert.equal((await planInstance.balances(user2)).toNumber(), 40);

      //when - 2
      await time.increase(time.duration.seconds(50));
      await planInstance.withdrawAllUserUnlockedToken();

      //then - 2
      //plan
      assert.equal((await planInstance.totalBalance()).toNumber(), 40);

      //user 1
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 30);
      assert.equal((await planInstance.balances(user1)).toNumber(), 0);

      //user 2
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 30);
      assert.equal((await planInstance.balances(user2)).toNumber(), 40);

      //when - 3
      await time.increase(time.duration.seconds(100));
      await planInstance.withdrawAllUserUnlockedToken();

      //then - 3
      //plan
      assert.equal((await planInstance.totalBalance()).toNumber(), 0);

      //user 1
      assert.equal((await tokenInstance.balanceOf(user1)).toNumber(), 30);
      assert.equal((await planInstance.balances(user1)).toNumber(), 0);

      //user 2
      assert.equal((await tokenInstance.balanceOf(user2)).toNumber(), 70);
      assert.equal((await planInstance.balances(user2)).toNumber(), 0);
    });

  });

  describe("Test Method: lockup", () => {
    it("Throw when contract balance is not enough", async () => {
      // Set Plan
      await planInstance.setLockPlan(user1, [0, 50], [10, 20]);
      
      // then
      await expectRevert(
        planInstance.lockup(), 
        "Depoisted contract balance is less than total locking amount"
      );
    });

    it("Throw when lockup after locked", async () => {
      // Lockup
      await planInstance.lockup();
      
      // then
      await expectRevert(
        planInstance.lockup(), 
        "Plan is locked"
      );
    });

    it("Should be successfully locked", async () => {
      // Lockup
      await planInstance.lockup();
      
      // then
      assert.equal(await planInstance.isLocked(), true);
    });
  });

  describe("Test Method: depositedEthBalance", () => {
    it("Should be zero", async () => {
      let amount = await planInstance.depositedEthBalance.call();
      assert.equal(amount.toNumber(), 0);
    });

    // it("Should be able to see balance", async () => {
    //   // given
    //   await web3.eth.sendTransaction({from: owner, to: planInstance.address, value: web3.utils.toWei('1')})

    //   // when
    //   let amount = await planInstance.depositedEthBalance();

    //   // then
    //   assert.equal(amount.toNumber(), 1000000000000000000)
    // });
  });

  describe("Test Method: transferDepositedTokensToOnwer", () => {
    it("Throw when called by not onwer", async () => {
      await expectRevert(
        planInstance.transferDepositedTokensToOnwer(100, txUser1), 
        "Ownable: caller is not the owner"
      );
    });

    it("Throw when locked", async () => {
      // Lockup
      await planInstance.lockup();

      // then
      await expectRevert(
        planInstance.transferDepositedTokensToOnwer(100), 
        "Plan is locked"
      );
    });

    it("Should be sent", async () => {
      //given
      const originalBalance = await tokenInstance.balanceOf(owner);
      await tokenInstance.transfer(planInstance.address, 100);

      //when
      await planInstance.transferDepositedTokensToOnwer(100);

      //then
      assert.equal((await tokenInstance.balanceOf(owner)).toNumber(), originalBalance);
    })
  });

  describe("Test Method: transferAccidentallyDepositedTokensToOnwer", () => {
    it("Throw when called by not onwer", async () => {
      await expectRevert(
        planInstance.transferAccidentallyDepositedTokensToOnwer(100, txUser1), 
        "Ownable: caller is not the owner"
      );
    });

    it("Throw when unlocked", async () => {
      await expectRevert(
        planInstance.transferAccidentallyDepositedTokensToOnwer(100), 
        "Plan is unlocked"
      );
    });

    it("Throw when insufficient balance", async () => {
      //given
      //lockup
      await planInstance.lockup();

      //then
      await expectRevert(
        planInstance.transferAccidentallyDepositedTokensToOnwer(100), 
        "Insufficient balance"
      );
    });

    it("Throw when amount excceed balance", async () => {
      //given
      //set plan
      await planInstance.setLockPlan(user1, [0, 50], [10, 20]);

      //put token
      await tokenInstance.transfer(planInstance.address, 31);

      //lockup
      await planInstance.lockup();

      //then
      await expectRevert(
        planInstance.transferAccidentallyDepositedTokensToOnwer(2), 
        "Amount excceed balance"
      );
    });

    it("Should be sent", async () => {
      //given
      //put token
      const originalBalance = await tokenInstance.balanceOf(owner);
      await tokenInstance.transfer(planInstance.address, 100);

      //set plan
      await planInstance.setLockPlan(user1, [0, 50], [10, 20]);

      //lockup
      await planInstance.lockup();

      //when
      await planInstance.transferAccidentallyDepositedTokensToOnwer(50);

      //then
      assert.equal((await tokenInstance.balanceOf(planInstance.address)).toNumber(), 50);
    })
  });

  describe("Test Method: transferAccidentallyDepositedOtherTokensToOnwer", () => {
    it("Throw when called by not onwer", async () => {
      await expectRevert(
        planInstance.transferAccidentallyDepositedOtherTokensToOnwer(tokenInstance.address, 100, txUser1), 
        "Ownable: caller is not the owner"
      );
    });

    it("Throw when token address is same as lock token address", async () => {
      await expectRevert(
        planInstance.transferAccidentallyDepositedOtherTokensToOnwer(tokenInstance.address, 100), 
        "Token address cannot be locked token"
      );
    });

    it("Should be sent", async () => {
      //given
      const token2Instance = await TestToken.new(1_000_000_000);
      const originalBalance = await tokenInstance.balanceOf(owner);
      await token2Instance.transfer(planInstance.address, 100);

      //when
      await planInstance.transferAccidentallyDepositedOtherTokensToOnwer(token2Instance.address, 100);

      //then
      assert.equal((await token2Instance.balanceOf(owner)).toNumber(), originalBalance);
    })
  });

  describe("Test Method: transferAccidentallyDepositedEthToOnwer", () => {
    it("Throw when called by not onwer", async () => {
      await expectRevert(
        planInstance.transferAccidentallyDepositedEthToOnwer(100, txUser1), 
        "Ownable: caller is not the owner"
      );
    });

    it("Should be sent", async () => {
      //given
      //send eth to contract
      await web3.eth.sendTransaction({from: owner, to: planInstance.address, value: 1})

      //when
      await planInstance.transferAccidentallyDepositedEthToOnwer(1)

      //then
      let contractEthBalance = await planInstance.depositedEthBalance.call();
      assert.equal(contractEthBalance.toNumber(), 0);
    });
  });

  describe("Test Method: receive", () => {
    it("Throw when locked", async () => {
      // Lockup
      await planInstance.lockup();

      // then
      // memo: EVM revert when send eth to contract
      await expectRevert.unspecified(
        web3.eth.sendTransaction({from: owner, to: planInstance.address, value: 1})
      );
    });

    it("Should be recevied", async () => {
      //given
      //send eth to contract
      await web3.eth.sendTransaction({from: owner, to: planInstance.address, value: 1});

      //when
      let contractEthBalance = await planInstance.depositedEthBalance.call();

      //then
      assert.equal(contractEthBalance.toNumber(), 1);
    });
  });

});