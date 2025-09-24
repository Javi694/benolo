// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Initializable {
    bool private _initialized;

    modifier initializer() {
        require(!_initialized, "Initializable: already");
        _initialized = true;
        _;
    }

    function _isInitialized() internal view returns (bool) {
        return _initialized;
    }
}
