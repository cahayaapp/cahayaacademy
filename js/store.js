import {
  db,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue
} from "./firebase.js";
import { objectToArray } from "./utils.js";

export async function getValue(path, fallback = null) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : fallback;
}

export async function setValue(path, value) {
  return set(ref(db, path), value);
}

export async function updateValues(values) {
  return update(ref(db), values);
}

export async function updateValue(path, value) {
  return update(ref(db, path), value);
}

export async function pushValue(path, value) {
  const item = push(ref(db, path));
  await set(item, value);
  return item.key;
}

export async function removeValue(path) {
  return remove(ref(db, path));
}

export function subscribe(path, callback) {
  return onValue(ref(db, path), (snap) => callback(snap.exists() ? snap.val() : null));
}

export async function getProfile(uid) {
  return getValue(`users/${uid}`);
}

export async function getPublicProfile(uid) {
  return getValue(`publicProfiles/${uid}`);
}

export async function getClass(classId) {
  return getValue(`classes/${classId}`);
}

export async function getMyClasses(uid, role) {
  if (role === "admin") {
    const classes = objectToArray(await getValue("classes", {}));
    return classes.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }

  const indexPath = role === "teacher" ? `teacherClasses/${uid}` : `userClasses/${uid}`;
  const ids = Object.keys(await getValue(indexPath, {}));
  const values = await Promise.all(ids.map(async (id) => {
    const item = await getClass(id);
    return item ? { id, ...item } : null;
  }));
  return values.filter(Boolean).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function getMeetings(classId) {
  return objectToArray(await getValue(`meetings/${classId}`, {}))
    .sort((a, b) => new Date(a.startAt || 0) - new Date(b.startAt || 0));
}

export async function getModules(classId) {
  return objectToArray(await getValue(`modules/${classId}`, {}))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

export async function getAssignments(classId) {
  return objectToArray(await getValue(`assignments/${classId}`, {}))
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
}

export async function getClassMembers(classId) {
  const members = objectToArray(await getValue(`classMembers/${classId}`, {}));
  const enriched = await Promise.all(members.map(async (member) => {
    const profile = await getPublicProfile(member.id);
    return { ...member, ...(profile || {}), uid: member.id };
  }));
  return enriched.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));
}

export async function getAllUsers() {
  return objectToArray(await getValue("users", {}))
    .map((item) => ({ ...item, uid: item.id }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));
}
