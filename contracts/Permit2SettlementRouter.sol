// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPermit2SignatureTransfer {
    struct TokenPermissions { address token; uint256 amount; }
    struct PermitTransferFrom { TokenPermissions permitted; uint256 nonce; uint256 deadline; }
    struct SignatureTransferDetails { address to; uint256 requestedAmount; }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

interface IERC20Transfer {
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title Permit2SettlementRouter
/// @notice Minimal single-chain settlement adapter for Permit2 SignatureTransfer.
/// @dev Deploy with the canonical Permit2 address for the target chain. This contract
///      pulls authorized tokens to itself, then forwards them to the recipient.
contract Permit2SettlementRouter {
    error ZeroAddress();
    error ZeroAmount();
    error TokenTransferFailed();

    IPermit2SignatureTransfer public immutable permit2;

    event Settled(address indexed owner, address indexed token, address indexed recipient, uint256 amount);

    constructor(address permit2Address) {
        if (permit2Address == address(0)) revert ZeroAddress();
        permit2 = IPermit2SignatureTransfer(permit2Address);
    }

    function settle(
        address token,
        address owner,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (token == address(0) || owner == address(0) || recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IPermit2SignatureTransfer.PermitTransferFrom memory permit = IPermit2SignatureTransfer.PermitTransferFrom({
            permitted: IPermit2SignatureTransfer.TokenPermissions({ token: token, amount: amount }),
            nonce: nonce,
            deadline: deadline
        });
        IPermit2SignatureTransfer.SignatureTransferDetails memory details =
            IPermit2SignatureTransfer.SignatureTransferDetails({ to: address(this), requestedAmount: amount });

        permit2.permitTransferFrom(permit, details, owner, signature);
        _safeTransfer(token, recipient, amount);
        emit Settled(owner, token, recipient, amount);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory data) = token.call(abi.encodeCall(IERC20Transfer.transfer, (to, amount)));
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert TokenTransferFailed();
    }
}
