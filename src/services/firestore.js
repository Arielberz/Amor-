import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase'

export const subscribeToCollection = (name, onData, onError) => onSnapshot(collection(db, name), (snapshot) => {
  onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
}, onError)

export const createDocument = (name, data) => addDoc(collection(db, name), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
export const updateDocument = (name, id, data) => updateDoc(doc(db, name, id), { ...data, updatedAt: serverTimestamp() })
export const deleteDocument = (name, id) => deleteDoc(doc(db, name, id))
