const os = require('os');

/**
 * Dynamically resolves the primary local physical network IPv4 address (Wi-Fi or Ethernet).
 * Filters out:
 * - Internal loopback (127.0.0.1)
 * - Auto-assigned link-local APIPA (169.254.x.x)
 * - Virtual/hypervisor adapters (WSL, Hyper-V, vEthernet, Docker, VM)
 * Prioritizes active physical adapters such as Wi-Fi, WLAN, or Ethernet.
 *
 * @returns {string|null} The resolved physical IPv4 string or null if not found.
 */
const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vethernet|virtual|hyper-v|docker|wsl|vmware/i.test(name);
    const isPhysical = /wi-fi|wlan|wireless|ethernet|eth|en/i.test(name);

    for (const iface of interfaces[name]) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('169.254')
      ) {
        candidates.push({
          name,
          address: iface.address,
          isPhysical,
          isVirtual,
        });
      }
    }
  }

  // 1. First priority: physical, non-virtual interface (e.g. Wi-Fi or Ethernet)
  const physicalMatch = candidates.find((c) => c.isPhysical && !c.isVirtual);
  if (physicalMatch) return physicalMatch.address;

  // 2. Second priority: any non-virtual interface
  const nonVirtualMatch = candidates.find((c) => !c.isVirtual);
  if (nonVirtualMatch) return nonVirtualMatch.address;

  // 3. Fallback: first available candidate
  return candidates.length > 0 ? candidates[0].address : null;
};

module.exports = { getLocalIpAddress };
