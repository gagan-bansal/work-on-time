const extend = require('extend')

class MemoryStore {
  constructor (opts) {
    this.tasks = []
  }

  init () {
    return Promise.resolve()
  }

  add (task) {
    this.tasks.push(task)
    return Promise.resolve(task)
  }
  findById(uuid) {
    return Promise.resolve(
      this.tasks.find(task => task.uuid === uuid))
  }

  remove (uuid) {
  }

  setPriority (uuid, priority) {
  }

  incompleteTasks (tillWhen) {
    let tasks = this.tasks.filter(t => {
      return !(t.status.completed || t.status.failed)
        && t.when < tillWhen
    })
    return Promise.resolve(tasks)
  }

  setStatus (uuid, status) {
    const self = this
    return this.findById(uuid).then(task => {
      if (task) {
        task.status = status
      } else {
        task = extend(true, {uuid}, status) 
        self.tasks.push(task)
      }
      return Promise.resolve(task)
    })
  }

  patchTask (uuid, data) {
    const self = this
    return this.findById(uuid).then(task => {
      if (task) {
        extend(true, task, data)
      } else {
        task = extend(true, {uuid}, data) 
        self.tasks.push(task)
      }
      return Promise.resolve(task)
    })
  }

  // TODO name can not be tasks so can we change the arrary name
  getTasks (status) {
    let tasks
    if (!status) {
      tasks = this.tasks
    } else {
      const nextStatus = statusOrder[status]
      if (nextStatus) {
        tasks = this.tasks.filter(t => t.status[status] && !t.status[nextStatus])
      } else {
        tasks = this.tasks.filter(t => t.status[status])
      }
    }
    return Promise.resolve(tasks)
  }
}

module.exports.MemoryStore = MemoryStore

