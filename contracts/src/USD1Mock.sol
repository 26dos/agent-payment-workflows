// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title USD1Mock
 * @dev Mock USD1 stablecoin for testing purposes
 * In production, this would be replaced with the actual USD1 token address
 */
contract USD1Mock is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("USD1 Mock", "USD1") Ownable(msg.sender) {
        // Mint initial supply to deployer for testing
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mint tokens to an address (only for testing)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Faucet function for testing - anyone can get test tokens
     * @param amount Amount of tokens to receive (max 10000 USD1)
     */
    function faucet(uint256 amount) external {
        require(amount <= 10000 * 10 ** DECIMALS, "USD1Mock: max 10000 USD1 per faucet");
        _mint(msg.sender, amount);
    }
}
