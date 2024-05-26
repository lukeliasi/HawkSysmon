/**
 * Configuration settings for the Resource Monitor.
 * 
 * @type {Object}
 * @property {number} cpuThreshold - The CPU usage threshold in percentage. Alerts are triggered if usage exceeds this value.
 * @property {number} memThreshold - The memory usage threshold in percentage. Alerts are triggered if usage exceeds this value.
 * @property {number} diskThreshold - The disk usage threshold in percentage. Alerts are triggered if usage exceeds this value.
 * @property {number} networkThreshold - The network usage threshold in megabytes (MB) per interval. Alerts are triggered if usage exceeds this value.
 * @property {number} cycles - The number of monitoring cycles a threshold must be exceeded before an alert is triggered.
 * @property {number} interval - The monitoring interval in milliseconds.
 * @property {Object} smtp - SMTP configuration for sending alert emails.
 */
module.exports = {
  /**
   * CPU usage threshold in percentage.
   * Alerts are triggered if CPU usage exceeds this value.
   * 
   * @type {number}
   */
  cpuThreshold: 80,

  /**
   * Memory usage threshold in percentage.
   * Alerts are triggered if memory usage exceeds this value.
   * 
   * @type {number}
   */
  memThreshold: 80,

  /**
   * Disk usage threshold in percentage.
   * Alerts are triggered if disk usage exceeds this value.
   * 
   * @type {number}
   */
  diskThreshold: 80,

  /**
   * Network usage threshold in megabytes (MB) per interval.
   * Alerts are triggered if network usage exceeds this value.
   * 
   * @type {number}
   */
  networkThreshold: 1000,

  /**
   * Number of monitoring cycles a threshold must be exceeded before an alert is triggered.
   * 
   * @type {number}
   */
  cycles: 3,

  /**
   * Monitoring interval in milliseconds.
   * 
   * @type {number}
   */
  interval: 60_000,

  smtp: {
    host: 'mail.example.com',
    port: 465,
    secure: true,
    auth: {
      user: 'username',
      pass: 'password'
    },
    from: 'monitor@example.com',
    to: 'user@example.com'
  }
};
