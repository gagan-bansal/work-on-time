module.exports = function (data) {
  if (data && ((data === true) ||  Object.keys(data).length > 0))
    return true
  else
    return false
}

