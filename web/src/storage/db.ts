/**
 * IndexedDB 封装
 *
 * 数据库名：2fa-vault
 * 存储：
 * - vault: 存储加密的 vault 数据（单条记录）
 */

const DB_NAME = '2fa-vault'
const DB_VERSION = 1
const STORE_NAME = 'vault'

/**
 * 打开 IndexedDB 数据库
 */
export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('打开 IndexedDB 失败'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // 创建 vault 存储（如果不存在）
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

/**
 * 从 IndexedDB 读取数据
 */
export async function getItem<T>(key: string): Promise<T | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.value : null)
    }

    request.onerror = () => {
      reject(new Error(`读取数据失败: ${key}`))
    }

    transaction.oncomplete = () => {
      db.close()
    }
  })
}

/**
 * 向 IndexedDB 写入数据
 */
export async function setItem<T>(key: string, value: T): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put({ id: key, value })

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error(`写入数据失败: ${key}`))
    }

    transaction.oncomplete = () => {
      db.close()
    }
  })
}

/**
 * 从 IndexedDB 删除数据
 */
export async function removeItem(key: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(key)

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error(`删除数据失败: ${key}`))
    }

    transaction.oncomplete = () => {
      db.close()
    }
  })
}

/**
 * 清空 IndexedDB（用于退出登录）
 */
export async function clearAll(): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => {
      reject(new Error('清空数据失败'))
    }

    transaction.oncomplete = () => {
      db.close()
    }
  })
}
