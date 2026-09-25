import { customAlphabet } from "nanoid";
import { Table } from "./game/table.js";

const genId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export class RoomManager {
  constructor() {
    this.tables = new Map();
  }

  createRoom(options) {
    let id;
    do {
      id = genId();
    } while (this.tables.has(id));
    const table = new Table(id, options);
    this.tables.set(id, table);
    return table;
  }

  get(id) {
    return this.tables.get(id?.toUpperCase());
  }

  remove(id) {
    this.tables.delete(id);
  }
}
