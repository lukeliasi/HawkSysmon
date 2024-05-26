const si = require('systeminformation');
const config = require('./config');
const alertService = require('./alerts');
const utils = require('./utils');

class ResourceMonitor {
  constructor() {
    this.alertCounters = {
      cpu: 0,
      memory: 0,
      disk: {},
      network: 0
    };

    this.alertStates = {
      cpu: false,
      memory: false,
      disk: {},
      network: false
    };
  }

  async initialize() {
    this.networkInterfaces = await utils.getNetworkInterfaces();
    this.printSystemInfo();
    this.startMonitoring();
  }

  startMonitoring() {
    this.printSystemResourcesSnapshot();
    setInterval(() => this.printSystemResourcesSnapshot(), config.interval);
  }

  async printSystemResourcesSnapshot() {
    try {
      const [cpu, memory, disk, networkTraffic, dockerStats, processes] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        utils.getNetworkTraffic(),
        utils.getDockerContainerStats(),
        si.processes()
      ]);

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
        this.checkThreshold(`disk_${diskInfo.fs}`, diskUsage, 'disk', config.diskThreshold);
      });

      console.log(`\nNetwork Traffic:`);
      networkTraffic.forEach(iface => {
        const sentMB = iface.tx_bytes / (1024 * 1024);
        const receivedMB = iface.rx_bytes / (1024 * 1024);
        console.log(`- ${iface.iface}: Sent ${sentMB.toFixed(2)} MB, Received ${receivedMB.toFixed(2)} MB`);
        this.checkThreshold(`network_${iface.iface}`, Math.max(sentMB, receivedMB), 'network', config.networkThreshold);
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

      this.checkThreshold('cpu', cpu.currentLoad, 'cpu', config.cpuThreshold);
      this.checkThreshold('memory', memUsage, 'memory', config.memThreshold, usedMem, totalMem);

    } catch (error) {
      console.error('Error getting system information:', error);
    }
  }

  checkThreshold(id, usage, type, threshold, used = null, total = null) {
    if (usage > threshold) {
      this.alertCounters[id] = (this.alertCounters[id] || 0) + 1;
      if (this.alertCounters[id] >= config.cycles && !this.alertStates[id]) {
        const subject = `[🚨 HawkSysmon Alert - ${type.charAt(0).toUpperCase() + type.slice(1)} Usage Exceeded Threshold]`;
        const message = this.constructAlertMessage(type, id, usage, used, total);
        console.log(subject, message);
        alertService.sendAlertEmail(message, subject);
        this.alertStates[id] = true;
      }
    } else {
      if (this.alertStates[id]) {
        const subject = `[✅ HawkSysmon Alert - ${type.charAt(0).toUpperCase() + type.slice(1)} Usage Recovered]`;
        const message = this.constructRecoveryMessage(type, id, usage, used, total);
        console.log(subject, message);
        alertService.sendAlertEmail(message, subject);
        this.alertStates[id] = false;
      }
      this.alertCounters[id] = 0;  // Reset counter only when usage is below threshold
    }
  }

  constructAlertMessage(type, resource, usage, used, total) {
    switch (type) {
      case 'cpu':
        return `CPU usage alert: ${usage.toFixed(2)}%`;
      case 'memory':
        return `Memory usage alert: ${usage.toFixed(2)}% (${used.toFixed(2)} GB / ${total.toFixed(2)} GB)`;
      case 'disk':
        return `Disk usage alert (${resource.split('_')[1]}): ${usage.toFixed(2)}%`;
      case 'network':
        return `Network traffic alert (${resource.split('_')[1]}): Usage ${usage.toFixed(2)} MB`;
      default:
        return `${type} usage alert: ${usage.toFixed(2)}%`;
    }
  }

  constructRecoveryMessage(type, resource, usage, used, total) {
    switch (type) {
      case 'cpu':
        return `CPU usage recovered: ${usage.toFixed(2)}%`;
      case 'memory':
        return `Memory usage recovered: ${usage.toFixed(2)}% (${used.toFixed(2)} GB / ${total.toFixed(2)} GB)`;
      case 'disk':
        return `Disk usage recovered (${resource.split('_')[1]}): ${usage.toFixed(2)}%`;
      case 'network':
        return `Network traffic recovered (${resource.split('_')[1]}): Usage ${usage.toFixed(2)} MB`;
      default:
        return `${type} usage recovered: ${usage.toFixed(2)}%`;
    }
  }

  async printSystemInfo() {
    const [system, osInfo] = await Promise.all([
      si.system(),
      si.osInfo()
    ]);

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
    this.networkInterfaces.forEach(iface => {
      console.log(`- ${iface.iface}: ${iface.ip4 && `IPv4:${iface.ip4}`} ${iface.ip6 && `IPv6:${iface.ip6}`} (MAC: ${iface.mac})`);
    });
  }
}

const monitor = new ResourceMonitor();
monitor.initialize();
