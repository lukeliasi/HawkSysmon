const si = require('systeminformation');

// Docker container thresholds (cpu/mem)
// Overall system thresholds
  // Network in/out 
  // Disk usage
  // CPU usage
  // Memory usage

// disable thresholds if not wanted
// use this: 🚨

async function run() {
  // Run the function immediately and then every 5 seconds
  printSystemResourcesSnapshot();
  setInterval(printSystemResourcesSnapshot, 5000);

  const system = await si.system();
  const osInfo = await si.osInfo();

  console.log(`\n === Starting Resource Monitor ===`);
  console.log(`\nSystem Information:`);
  console.log(`----------------------------------------`);
  console.log(`OS: ${osInfo.distro} ${osInfo.release} (${osInfo.arch})`);
  console.log(`Hostname: ${osInfo.hostname}`);
  console.log(`Platform: ${osInfo.platform}`);
  console.log(`Architecture: ${osInfo.arch}`);
  console.log(`Manufacturer: ${system.manufacturer}`);
  console.log(`Model: ${system.model}`);
  console.log(`----------------------------------------`);
}


async function getNetworkInterfaces() {
  const interfaces = await si.networkInterfaces();

  return interfaces.filter((iface) => {
    return (iface.internal === false) // Only show external interfaces
      && (iface.ip4 || iface.ip6) // Only show interfaces with an IP address
  });
};

const getNetworkTraffic = async () => {
  const networkStats = await si.networkStats();
  return networkStats;
};

async function getDockerContainerStats() {
  try {
      const dockerInfo = await si.dockerInfo();
      if (dockerInfo.containersRunning === 0) {
          return [];
      }

      const containers = await si.dockerContainers();
      const containerStats = await si.dockerContainerStats('*');
      
      return containerStats.map(stat => {
          const container = containers.find(c => c.id === stat.id);
          return {
              name: container ? container.name : 'unknown',
              cpuPercent: stat.cpuPercent,
              memUsage: stat.memUsage / (1024 * 1024), // convert to MB
              memLimit: stat.memLimit / (1024 * 1024), // convert to MB
              memPercent: stat.memPercent
          };
      });
  } catch (error) {
      console.error('Error getting Docker container stats:', error);
      return [];
  }
}

const printSystemResourcesSnapshot = async () => {
  try {
    const cpu = await si.currentLoad();
    const memory = await si.mem();
    const disk = await si.fsSize();
    const networkInterfaces = await getNetworkInterfaces();
    const networkTraffic = await getNetworkTraffic();
    const dockerStats = await getDockerContainerStats();
    const processes = await si.processes();

    const totalMem = memory.total / (1024 * 1024 * 1024); // in GB
    const usedMem = memory.used / (1024 * 1024 * 1024); // in GB
    const memUsage = (memory.used / memory.total) * 100;

    const currentTime = new Date().toLocaleString();

    console.log(`\nReport ${currentTime}:`);
    console.log(`----------------------------------------`);
    console.log(`CPU Usage: ${cpu.currentLoad.toFixed(2)}%`);
    console.log(`Memory Usage: ${memUsage.toFixed(2)}% (${usedMem.toFixed(2)} GB / ${totalMem.toFixed(2)} GB)`);

    disk.forEach(diskInfo => {
      const totalDisk = diskInfo.size / (1024 * 1024 * 1024); // in GB
      const usedDisk = diskInfo.used / (1024 * 1024 * 1024); // in GB
      const diskUsage = (diskInfo.used / diskInfo.size) * 100;
      console.log(`Disk Usage (${diskInfo.fs}): ${diskUsage.toFixed(2)}% (${usedDisk.toFixed(2)} GB / ${totalDisk.toFixed(2)} GB)`);
    });

    console.log(`Network Interfaces:`);
    networkInterfaces.forEach((iface) => {
      console.log(`- ${iface.iface}: ${iface.ip4 && `IPv4:${iface.ip4}`} ${iface.ip4 && `IPv6:${iface.ip6}`} (MAC: ${iface.mac})`);
    });

    console.log(`Network Traffic:`);
    networkTraffic.forEach((iface) => {
      console.log(`- ${iface.iface}: Sent ${(iface.tx_bytes / (1024 * 1024)).toFixed(2)} MB, Received ${(iface.rx_bytes / (1024 * 1024)).toFixed(2)} MB`);
    });

    if (dockerStats.length > 0) {
      console.log(`Docker Container Usage:`);
      dockerStats.forEach(container => {
        console.log(`- ${container.name}: CPU Usage: ${container.cpuPercent.toFixed(2)}%, Memory Usage: ${container.memUsage.toFixed(2)} MB / ${container.memLimit.toFixed(2)} MB (${container.memPercent.toFixed(2)}%)`);
      });
    } else {
      console.log('Docker Container Usage: N/A');
    }

    // Print top 5 CPU consuming processes
    const topCpuProcesses = processes.list.sort((a, b) => b.cpu - a.cpu).slice(0, 5);
    console.log(`\nTop 5 CPU consuming processes:`);
    topCpuProcesses.forEach((proc, index) => {
      console.log(`${index + 1}. ${proc.name} - ${proc.cpu.toFixed(2)}% CPU`);
    });

    // Print top 5 Memory consuming processes
    const topMemProcesses = processes.list.sort((a, b) => b.mem - a.mem).slice(0, 5);
    console.log(`\nTop 5 Memory consuming processes:`);
    topMemProcesses.forEach((proc, index) => {
      console.log(`${index + 1}. ${proc.name} - ${proc.mem.toFixed(2)}% Memory`);
    });

    console.log(`----------------------------------------`);
  } catch (error) {
    console.error('Error getting system information:', error);
  }
};

run();