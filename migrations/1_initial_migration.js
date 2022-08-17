const TokenLockPlan = artifacts.require("TokenLockPlan");

module.exports = function (deployer) {
  deployer.deploy(TokenLockPlan, "0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8");
};
