import { WebSocketServer } from "ws";
import { createLogger } from "./logger.js";

const logger = createLogger("WebSocket");

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.activeRecordings = new Map(); // recordingId -> { name, startTime, duration, streamName }
    this.getScheduleState = null;
  }

  /**
   * Initialize WebSocket server with existing HTTP server
   */
  initialize(server, options = {}) {
    this.getScheduleState = options.getScheduleState || null;
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      logger.info(`Client connected. Total clients: ${this.clients.size + 1}`);
      this.clients.add(ws);

      // Send initial state to new client
      this.sendStateToClient(ws);

      ws.on("close", () => {
        this.clients.delete(ws);
        logger.info(`Client disconnected. Total clients: ${this.clients.size}`);
      });

      ws.on("error", (err) => {
        logger.error("WebSocket error:", err.message);
      });
    });

    logger.info("WebSocket server initialized");
  }

  /**
   * Start tracking a recording
   */
  startRecording(recordingId, recordingName, duration, streamName) {
    const startTime = new Date();
    this.activeRecordings.set(recordingId, {
      name: recordingName,
      startTime: startTime.toISOString(),
      duration,
      streamName
    });

    logger.info(`Recording started: ${recordingId} (${recordingName}) - Total active: ${this.activeRecordings.size}`);
    this.broadcastStatus();
  }

  /**
   * Stop tracking a recording
   */
  stopRecording(recordingId) {
    const recording = this.activeRecordings.get(recordingId);
    if (recording) {
      logger.info(`Recording stopped: ${recordingId} (${recording.name}) - Total active: ${this.activeRecordings.size - 1}`);
      this.activeRecordings.delete(recordingId);
      this.broadcastStatus();
    } else {
      logger.warn(`stopRecording called for unknown ID: ${recordingId}`);
    }
  }

  /**
   * Broadcast current recording status to all connected clients
   */
  broadcastStatus() {
    const status = {
      type: "recording-status",
      activeCount: this.activeRecordings.size,
      recordings: Array.from(this.activeRecordings.entries()).map(([id, data]) => ({
        id,
        ...data
      }))
    };

    logger.info(`[broadcastStatus] Broadcasting to ${this.clients.size} clients: ${this.activeRecordings.size} active recordings`);

    this.broadcastMessage(status);
  }

  broadcastScheduleState(scheduleState = this.getScheduleState?.()) {
    if (!scheduleState) {
      return;
    }

    const status = {
      type: "schedule-state",
      ...scheduleState,
    };

    logger.info(`[broadcastScheduleState] Broadcasting to ${this.clients.size} clients: ${scheduleState.schedules?.length || 0} schedules`);

    this.broadcastMessage(status);
  }

  broadcastMessage(payload) {
    const message = JSON.stringify(payload);

    this.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(message, (err) => {
          if (err) {
            logger.error(`[broadcastMessage] Send error: ${err.message}`);
          }
        });
      }
    });
  }

  /**
   * Send current state to a specific client
   */
  sendStateToClient(ws) {
    const recordingStatus = {
      type: "recording-status",
      activeCount: this.activeRecordings.size,
      recordings: Array.from(this.activeRecordings.entries()).map(([id, data]) => ({
        id,
        ...data
      }))
    };

    ws.send(JSON.stringify(recordingStatus), (err) => {
      if (err) {
        logger.error("Failed to send initial state:", err.message);
      }
    });

    const scheduleState = this.getScheduleState?.();
    if (!scheduleState) {
      return;
    }

    ws.send(JSON.stringify({ type: "schedule-state", ...scheduleState }), (err) => {
      if (err) {
        logger.error("Failed to send initial schedule state:", err.message);
      }
    });
  }

  /**
   * Get active recording count
   */
  getActiveCount() {
    return this.activeRecordings.size;
  }

  /**
   * Get all active recordings
   */
  getActiveRecordings() {
    return Array.from(this.activeRecordings.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  /**
   * Close all connections
   */
  close() {
    this.clients.forEach((client) => {
      client.close();
    });
    if (this.wss) {
      this.wss.close();
    }
    logger.info("WebSocket server closed");
  }
}

export const wsManager = new WebSocketManager();
