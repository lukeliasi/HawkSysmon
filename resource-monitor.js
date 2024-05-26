const si = require('systeminformation');
const nodemailer = require('nodemailer');

// Configuration for thresholds and cycles
const config = {
  cpuThreshold: 5, // CPU usage threshold in percentage
  memThreshold: 85, // Memory usage threshold in percentage
  diskThreshold: 80, // Disk usage threshold in percentage
  networkThreshold: 1000, // Network usage threshold in MB (per interval)
  cycles: 3, // Number of cycles threshold must be broken to trigger alert
  interval: 5000, // Interval in milliseconds
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@example.com',
      pass: 'your-email-password'
    },
    from: 'monitor@example.com',
    to: 'alert-recipient@example.com'
  }
};

let alertCounters = {
  cpu: 0,
  memory: 0,
  disk: {},
  network: 0,
};

let alertStates = {
  cpu: false,
  memory: false,
  disk: {},
  network: false,
};

async function run() {
  const networkInterfaces = await getNetworkInterfaces();

  // Run the function immediately and then every interval
  printSystemResourcesSnapshot(networkInterfaces);
  setInterval(() => printSystemResourcesSnapshot(networkInterfaces), config.interval);

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

  console.log(`\nNetwork Interfaces:`);
  networkInterfaces.forEach((iface) => {
    console.log(`- ${iface.iface}: ${iface.ip4 && `IPv4:${iface.ip4}`} ${iface.ip4 && `IPv6:${iface.ip6}`} (MAC: ${iface.mac})`);
  });
}

async function getNetworkInterfaces() {
  const interfaces = await si.networkInterfaces();
  return interfaces.filter((iface) => {
    return (iface.internal === false) // Only show external interfaces
      && (iface.ip4 || iface.ip6); // Only show interfaces with an IP address
  });
}

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

const printSystemResourcesSnapshot = async (networkInterfaces) => {
  try {
    const cpu = await si.currentLoad();
    const memory = await si.mem();
    const disk = await si.fsSize();
    const networkTraffic = await getNetworkTraffic();
    const dockerStats = await getDockerContainerStats();
    const processes = await si.processes();

    const totalMem = memory.total / (1024 * 1024 * 1024); // in GB
    const usedMem = memory.used / (1024 * 1024 * 1024); // in GB
    const memUsage = (memory.used / memory.total) * 100;

    const currentTime = new Date().toLocaleString();

    console.log(`\n----------------------------------------`);
    console.log(`REPORT ${currentTime}`);
    console.log(`\nCPU Usage: ${cpu.currentLoad.toFixed(2)}%`);
    console.log(`Memory Usage: ${memUsage.toFixed(2)}% (${usedMem.toFixed(2)} GB / ${totalMem.toFixed(2)} GB)\n`);

    disk.forEach(diskInfo => {
      const totalDisk = diskInfo.size / (1024 * 1024 * 1024); // in GB
      const usedDisk = diskInfo.used / (1024 * 1024 * 1024); // in GB
      const diskUsage = (diskInfo.used / diskInfo.size) * 100;
      console.log(`Disk Usage (${diskInfo.fs}): ${diskUsage.toFixed(2)}% (${usedDisk.toFixed(2)} GB / ${totalDisk.toFixed(2)} GB)`);
      // Disk threshold check
      if (diskUsage > config.diskThreshold) {
        alertCounters.disk[diskInfo.fs] = (alertCounters.disk[diskInfo.fs] || 0) + 1;
        if (alertCounters.disk[diskInfo.fs] >= config.cycles && !alertStates.disk[diskInfo.fs]) {
          console.log(`🚨 Disk usage alert (${diskInfo.fs}): ${diskUsage.toFixed(2)}%`);
          sendAlertEmail(`Disk usage alert (${diskInfo.fs}): ${diskUsage.toFixed(2)}%`);
          alertStates.disk[diskInfo.fs] = true;
        }
      } else {
        if (alertStates.disk[diskInfo.fs]) {
          console.log(`✅ Disk usage recovered (${diskInfo.fs}): ${diskUsage.toFixed(2)}%`);
          sendAlertEmail(`Disk usage recovered (${diskInfo.fs}): ${diskUsage.toFixed(2)}%`);
          alertStates.disk[diskInfo.fs] = false;
        }
        alertCounters.disk[diskInfo.fs] = 0;
      }
    });

    console.log(`\nNetwork Traffic:`);
    networkTraffic.forEach((iface) => {
      const sentMB = iface.tx_bytes / (1024 * 1024);
      const receivedMB = iface.rx_bytes / (1024 * 1024);
      console.log(`- ${iface.iface}: Sent ${sentMB.toFixed(2)} MB, Received ${receivedMB.toFixed(2)} MB`);
      // Network threshold check
      if (sentMB > config.networkThreshold || receivedMB > config.networkThreshold) {
        alertCounters.network += 1;
        if (alertCounters.network >= config.cycles && !alertStates.network) {
          console.log(`🚨 Network traffic alert (${iface.iface}): Sent ${sentMB.toFixed(2)} MB, Received ${receivedMB.toFixed(2)} MB`);
          sendAlertEmail(`Network traffic alert (${iface.iface}): Sent ${sentMB.toFixed(2)} MB, Received ${receivedMB.toFixed(2)} MB`);
          alertStates.network = true;
        }
      } else {
        if (alertStates.network) {
          console.log(`✅ Network traffic recovered (${iface.iface}): Sent ${sentMB.toFixed(2)} MB, Received ${receivedMB.toFixed(2)} MB`);
          sendAlertEmail(`Network traffic recovered (${iface.iface}): Sent ${sentMB.toFixed(2)} MB, Received ${receivedMB.toFixed(2)} MB`);
          alertStates.network = false;
        }
        alertCounters.network = 0;
      }
    });

    if (dockerStats.length > 0) {
      console.log(`\nDocker Container Usage:`);
      dockerStats.forEach(container => {
        console.log(`- ${container.name}:`);
        console.log(`     CPU Usage: ${container.cpuPercent.toFixed(2)}%`);
        console.log(`     Memory Usage: ${container.memUsage.toFixed(2)} MB / ${container.memLimit.toFixed(2)} MB (${container.memPercent.toFixed(2)}%)`);
      });
    } else {
      console.log('\nDocker Container Usage: N/A');
    }

    console.log(`----------------------------------------`);

    // Check CPU and Memory thresholds
    if (cpu.currentLoad > config.cpuThreshold) {
      alertCounters.cpu += 1;
      if (alertCounters.cpu >= config.cycles && !alertStates.cpu) {
        console.log(`🚨 CPU usage alert: ${cpu.currentLoad.toFixed(2)}%`);
        sendAlertEmail(`CPU usage alert: ${cpu.currentLoad.toFixed(2)}%`);
        alertStates.cpu = true;
      }
    } else {
      if (alertStates.cpu) {
        console.log(`✅ CPU usage recovered: ${cpu.currentLoad.toFixed(2)}%`);
        sendAlertEmail(`CPU usage recovered: ${cpu.currentLoad.toFixed(2)}%`);
        alertStates.cpu = false;
      }
      alertCounters.cpu = 0;
    }

    if (memUsage > config.memThreshold) {
      alertCounters.memory += 1;
      if (alertCounters.memory >= config.cycles && !alertStates.memory) {
        console.log(`🚨 Memory usage alert: ${memUsage.toFixed(2)}% (${usedMem.toFixed(2)} GB / ${totalMem.toFixed(2)} GB)`);
        sendAlertEmail(`Memory usage alert: ${memUsage.toFixed(2)}% (${usedMem.toFixed(2)} GB / ${totalMem.toFixed(2)} GB)`);
        alertStates.memory = true;
      }
    } else {
      if (alertStates.memory) {
        console.log(`✅ Memory usage recovered: ${memUsage.toFixed(2)}% (${usedMem.toFixed(2)} GB / ${totalMem.toFixed(2)} GB)`);
        sendAlertEmail(`Memory usage recovered: ${memUsage.toFixed(2)}% (${usedMem.toFixed(2)} GB / ${totalMem.toFixed(2)} GB)`);
        alertStates.memory = false;
      }
      alertCounters.memory = 0;
    }

  } catch (error) {
    console.error('Error getting system information:', error);
  }
};

function sendAlertEmail(message) {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.auth.user,
      pass: config.smtp.auth.pass
    }
  });

  const mailOptions = {
    from: config.smtp.from,
    to: config.smtp.to,
    subject: 'Resource Monitor Alert',
    text: message
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error('Error sending email:', error);
    }
    console.log('Alert email sent:', info.response);
  });
}

run();
