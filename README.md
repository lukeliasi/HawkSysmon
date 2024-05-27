<img src="logo.png" alt="HawkSysmon Logo" width="160"/>

# HawkSysmon

HawkSysmon is a resource monitoring tool designed to keep track of system metrics and alert users when specific thresholds are crossed. It monitors CPU usage, memory usage, disk usage, and network traffic. If any of these metrics exceed the defined thresholds for a specified number of cycles, it triggers an alert. Once the usage returns to normal, it sends a recovery alert.

## Features
- Monitors CPU, memory, disk, and network usage.
- Configurable thresholds and alert cycles.
- Sends email alerts when usage exceeds thresholds.
- Sends recovery alerts when usage returns to normal.

## Quick Start

1. Clone the repository:
    ```bash
    git clone https://github.com/lukeliasi/HawkSysmon.git
    cd HawkSysmon
    ```
2. Edit the configuration file in `config.js`

3. Run via docker:

`docker compose up` 

*OR*

3. Run standalone:

Install dependencies and run:
```bash
npm install
npm run start
```

# TODO:
  - Add more alerts transports, e.g: SMS, Slack, Telegram, etc...
  - Web UI
