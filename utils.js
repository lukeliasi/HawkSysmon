const si = require('systeminformation');

module.exports = {
  async getNetworkInterfaces() {
    const interfaces = await si.networkInterfaces();
    return interfaces.filter(iface => !iface.internal && (iface.ip4 || iface.ip6));
  },

  async getNetworkTraffic() {
    return await si.networkStats();
  },

  async getDockerContainerStats() {
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
};
