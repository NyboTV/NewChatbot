exports.timeout = async (ms) => {
    return new Promise(async (resolve, reject) => {
        ms = Number(ms)
        setTimeout(() => {
            resolve();
        }, ms);
    })
}



