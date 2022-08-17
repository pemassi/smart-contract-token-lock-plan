const TokenLockPlan = artifacts.require("TokenLockPlan");

contract("TokenLockPlan", (accounts) => {
  let instance;

  let _tokenContract = "0x6BDd97Dfb3BEbc61aDC2Be51a0776fb3003B839e";


  beforeEach(async () => {
    instance = await TokenLockPlan.new(_tokenContract);
  });

  describe("Check sucessfully initialized", () => {
    it("isLocked should be false", async () => {
      assert.equal(await instance.isLocked(), false);
    });
  });
  
});