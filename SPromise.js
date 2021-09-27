// 定义三种状态类型
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

// 设置初始状态
class SPromise {
  constructor(fn) {
    // 初始状态为pending
    this.status = PENDING
    this.value = null
    this.reason = null
    try {
      fn(this.resolve.bind(this), this.rejected.bind(this))
    } catch (e) {
      this.rejected(e)
    }
  }

  FULFILLED_CALLBACK_LIST = []
  REJECTED_CALLBACK_LIST = []
  _status = PENDING

  get status() {
    return this._status
  }

  set status(val) {
    this._status = val
    // console.log('tttt11 set status this._status=', val)
    switch (val) {
      case FULFILLED:
        this.FULFILLED_CALLBACK_LIST.forEach(callback => {
          callback(this.value)
        })
        break
      case REJECTED:
        this.REJECTED_CALLBACK_LIST.forEach(callback => {
          callback(this.reason)
        })
        break
    }
  }

  resolve(value) {
    if (this.status === PENDING) {
      // console.log('tttt1 resolve this.value=' + this.value + ',this.status=' + this.status)
      this.value = value
      this.status = FULFILLED
    }
  }

  rejected(reason) {
    if (this.status === PENDING) {
      // console.log('tttt2 rejected this.reason=' + this.reason + ',this.status=' + this.status)
      this.reason = reason
      this.status = REJECTED
    }
  }

  then(onFulfilled, onRejected) {
    const realOnFulfilled = this.isFunction(onFulfilled) ? onFulfilled : value => value
    const realOnRejected = this.isFunction(onRejected) ? onRejected : reason => { throw reason }
    const promise2 = new SPromise((resolve, reject) => {
      const fulfilledMicrotask = () => {
        queueMicrotask(() => {
          try{
            const x = realOnFulfilled(this.value)
            // console.log('tttt3 FULFILLED_CALLBACK this.value=>', this.value, x)
            this.resolvePromise(promise2, x, resolve, reject)
          }catch (e) {
            reject(e)
          }
        })
      }
      const rejectedMicrotask = () => {
        queueMicrotask(() => {
          try{
            const x = realOnRejected(this.reason)
            // console.log('tttt4 REJECTED_CALLBACK this.reason=>', this.reason, x)
            this.resolvePromise(promise2, x, resolve, reject)
          }catch (e) {
            reject(e)
          }
        })
      }
      // console.log('tttt9 then promise2 this.status=>', this.status)
      switch (this.status) {
        case FULFILLED:
          fulfilledMicrotask()
          break;
        case REJECTED:
          rejectedMicrotask()
        case PENDING:
          this.FULFILLED_CALLBACK_LIST.push(fulfilledMicrotask)
          this.REJECTED_CALLBACK_LIST.push(rejectedMicrotask)
      }
      // console.log('tttt10 then promise2 this.FULFILLED_CALLBACK_LIST=>', this.FULFILLED_CALLBACK_LIST, this.REJECTED_CALLBACK_LIST)
    })
    return promise2
  }

  catch(onRejected) {
    // console.log('tttt6 catch onRejected=', onRejected)
    return this.then(null, onRejected)
  }

  static resolve(value) {
    // console.log('tttt7 resolve value=', value)
    if (value instanceof SPromise) {
      return value
    }

    return new SPromise((resolve) => {
      resolve(value)
    })
  }

  static reject(reason) {
    // console.log('tttt8 reject reason=', reason)
    return new SPromise((resolve, reject) => {
      reject(reason)
    })
  }

  static race(promiseList) {
    return new SPromise((resolve, reject) => {
      const length = promiseList.length
      if (length === 0) {
        return resolve()
      } else {
        for (let i = 0; i < length; i++) {
          SPromise.resolve(promiseList[i]).then(
            (value) => {
            return resolve(value)
          }, (reason) => {
            return reject(reason)
          })
        }
      }
    })
  }

  static all(promiseList) {
    return new SPromise((resolve, reject) => {
      let count = 0;
      const values = [];
      for (const [i, SPromiseInstance] of promiseList.entries()) {
        SPromiseInstance.then(
          (value) => {
            values[i] = value;
            count++;
            if (count === promiseList.length) {
              resolve(values)
            }
          },
          (reason) => {
            return reject(reason)
          })
      }
    });
  }

  resolvePromise(promise2, x, resolve, reject) {
    // console.log('tttt5 resolvePromise promise2 x', promise2, x)
    if (promise2 === x) {
      return reject(new TypeError('The promise and the return value are the same'))
    }
    if (x instanceof SPromise) {
      // 如果 x 为 Promise ，则使 newPromise 接受 x 的状态
      // 也就是继续执行x，如果执行的时候拿到一个y，还要继续解析y
      queueMicrotask(() => {
        x.then((y) => {
          this.resolvePromise(promise2, y, resolve, reject);
        }, reject);
      })
    } else if (typeof x === 'object' || this.isFunction(x)) {
      // 如果 x 为对象或者函数
      if (x === null) {
        // null也会被判断为对象
        return resolve(x);
      }

      let then = null;

      try {
        // 把 x.then 赋值给 then
        then = x.then;
      } catch (error) {
        // 如果取 x.then 的值时抛出错误 e ，则以 e 为据因拒绝 promise
        return reject(error);
      }

      // 如果 then 是函数
      if (this.isFunction(then)) {
        let called = false;
        // 将 x 作为函数的作用域 this 调用
        // 传递两个回调函数作为参数，第一个参数叫做 resolvePromise ，第二个参数叫做 rejectPromise
        try {
          then.call(
            x,
            // 如果 resolvePromise 以值 y 为参数被调用，则运行 resolvePromise
            (y) => {
              // 需要有一个变量called来保证只调用一次.
              if (called) return;
              called = true;
              this.resolvePromise(promise2, y, resolve, reject);
            },
            // 如果 rejectPromise 以据因 r 为参数被调用，则以据因 r 拒绝 promise
            (r) => {
              if (called) return;
              called = true;
              reject(r);
            });
        } catch (error) {
          // 如果调用 then 方法抛出了异常 e：
          if (called) return;

          // 否则以 e 为据因拒绝 promise
          reject(error);
        }
      } else {
        // 如果 then 不是函数，以 x 为参数执行 promise
        resolve(x);
      }
    } else {
      // 如果 x 不为对象或者函数，以 x 为参数执行 promise
      resolve(x);
    }
  }

  isFunction(params) {
    return typeof params === 'function'
  }
}


// 测试
const testPromise = new SPromise((resolve, reject) => {
  setTimeout(() => {
    resolve(111)
  }, 1000)
}).then(value => {
  console.log('value=', value)
  // return value
})

console.log(testPromise)

setTimeout(() => {
  console.log(testPromise)
}, 2000)

/**
 * 为什么promise resolve了一个value, 最后输出的value值确是undefined
 * 因为现在这种写法, 相当于在.then里return undefined, 所以最后的value是undefined.
 * 如果显式return一个值, 就不是undefined了；比如return value.
 */

// const test = new SPromise((resolve, reject) => {
//   setTimeout(() => {
//     resolve(111)
//   }, 1000)
// }).then(value => {
//   console.log('value1=', value)
//   return value
// }).then(value => {
//   console.log('value2=', value + 1)
//   return value + 1
// }).then(value => {
//   console.log('value3=', value + 1)
//   return value + 1
// })
//
// console.log(test)
//
// setTimeout(() => {
//   console.log(test)
// }, 3000)

/**
 * 链式调用的时候每一个.then返回的都是一个新promise, 所以每次回调数组FULFILLED_CALLBACK_LIST都是空数组,
 * 针对这种情况, 确实用数组来存储回调没意义, 完全可以就用一个变量来存储,
 * 但是还有一种promise使用的方式, 这种情况下, promise实例是同一个, 数组的存在就有了意义,如下
 */

// test.then(value => {
//   console.log('value4=', value + 1)
//   return value + 1
// })
// test.then(value => {
//   console.log('value5=', value + 1)
//   return value + 1
// })
// test.then(value => {
//   console.log('value6=', value + 1)
//   return value + 1
// })
// test.then(value => {
//   console.log('value7=', value + 1)
//   return value + 1
// })
//
// console.log(test)
//
// setTimeout(() => {
//   console.log(test)
// }, 3000)

//race all测试
// const test1 = new SPromise((resolve, reject) => {
//   setTimeout(() => {
//     resolve('aaaa')
//   }, 3000)
// })
//
// const test2 = new SPromise((resolve, reject) => {
//   setTimeout(() => {
//     resolve('bbbb')
//   }, 2000)
// })
//
// const test3 = new SPromise((resolve, reject) => {
//   setTimeout(() => {
//     resolve('cccc')
//   }, 1000)
// })
//
// SPromise.race([test1, test2, test3]).then((val) => {
//   console.log('有一个promise状态已经改变', val)
// })
//
// SPromise.all([test1, test2, test3]).then((result) => {
//   console.log('Promise.all', result)
// })
//
//
// const promise1 = function() {
//   return new Promise(function(resolve) {
//     setTimeout(function() {
//       console.log(1)
//       resolve(1)
//     }, 1000)
//   })
// }
//
// const promise2 = function() {
//   return new Promise(function(resolve) {
//     setTimeout(function() {
//       console.log(2)
//       resolve(2)
//     }, 2000)
//   })
// }
// Promise.race([promise1(), promise2()])
//   .then(function(val) {
//     console.log('有⼀个 promise 状态已经改变', val)
//   })
//
// Promise.all([promise1(), promise2()])
//   .then(function(val) {
//     console.log('Promise.all 结果', val)
//   })


// 测试catch
// const test4 = new SPromise((resolve, reject) => {
//   setTimeout(() => {
//     console.log('to reject=>' + 111);
//     reject(111)
//   }, 1000)
// }).catch(reason => {
//   console.log('报错' + reason);
//   console.log(test4)
// })
//
// setTimeout(() => {
//   console.log('----------------------------');
//   console.log(test4);
// }, 2000)

/**
 * catch 函数会返回一个新的promise, 而test4就是这个新promise
 * catch 的回调里, 打印promise的时候, 整个回调还并没有执行完成(所以此时的状态是pending), 只有当整个回调完成了, 才会更改状态
 * catch 的回调函数, 如果成功执行完成了, 会改变这个新Promise的状态为fulfilled
 */
