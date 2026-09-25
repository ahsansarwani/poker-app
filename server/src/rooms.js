import { customAlphabet } from "nanoid";
import { Table } from "./game/table.js";
import { BluffGame } from "./game/bluff.js";

const genId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export const GAME_CLASSES = {
  holdem: Table,
  bluff: BluffGame,
};

export class RoomManager {
  constructor() {
    this.tables = new Map();
  }

  createRoom(gameType, options) {
    const GameClass = GAME_CLASSES[gameType];
    if (!GameClass) throw new Error(`Unknown game type: ${gameType}`);
    let id;
    do {
      id = genId();
    } while (this.tables.has(id));
    const table = new GameClass(id, options);
    table.gameType = gameType;
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
