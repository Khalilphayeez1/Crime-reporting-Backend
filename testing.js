let cnicRegex = /^[0-9+]{5}-[0-9+]{7}-[0-9]{1}$/
let cnicValidator = (cnic) => cnicRegex.test(cnic);


console.log(cnicValidator("32423-2343433-3"))
