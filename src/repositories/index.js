import database from "../../db/index.js";
import MemberRoomRepository from "./member-room-repository.js";
import RoomRepository from "./room-repository.js";

const membersRepository = MemberRoomRepository(database);

export const respositories = {
  roomRepository: RoomRepository(database, membersRepository),
  membersRepository,
};
