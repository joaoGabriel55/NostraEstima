import Valkey from "iovalkey";

const valkey = new Valkey();

async function set(key, value) {
  return valkey.set(key, value);
}

async function get(key) {
  return valkey.get(key);
}

async function del(key) {
  return valkey.del(key);
}

async function clear() {
  return valkey.clear();
}

async function exists(key) {
  return valkey.exists(key);
}

export const db = {
  set,
  get,
  del,
  clear,
  exists,
};
