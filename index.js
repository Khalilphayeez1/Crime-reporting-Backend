const express = require("express");
const bcrypt = require("bcryptjs");
const mysqlConnection = require("./database/database_connection");
const dotenv = require("dotenv");
dotenv.config();
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary");
const otpGenerator = require("otp-generator"); 
const { DatabaseError } = require("sequelize");

const app = express();
const router = express.Router();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/", router);

const nodemailer = require("nodemailer");

// Send otp to user email address to verify the user
const transporter = nodemailer.createTransport({
  service: "hotmail",
  auth: {      
    user: "your outlook account",
    pass: "password",
  },
  secure: false,
  port: 25,
  tls: {
    rejectUnauthorized: false,
  },  
});

var mailOptions = {
  from: "your gamil",
  to: "someone else gmail",   
  subject: "none0",
  text: "Test otp",
};

app.post("/send-otp", (req, res) => {
  // generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000);

  // save OTP to database
  const {email} = req.body;
  mysqlConnection.query("INSERT INTO otp (email, otp_code) VALUES (?, ?)",[email, otp],
    (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error updating OTP"); 
      } else {
        // send email to user
        const mailOptions = {
          from: "khalilphayeez2024@outlook.com",
          to: email,
          subject: "Your OTP",  
          text: `Your crime_reporting account verfication code is: ${otp}. Don't share it.`,
        };
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error(err);
            res.status(500).send("Error sending OTP email");
          } else {
            res.send("OTP sent to " + email);
          }
        });
      }
    }
  );
});

// Verfiy-OTP
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  mysqlConnection.query(
    "SELECT * FROM otp WHERE email = ? AND otp_code = ?",
    [email, otp],
    (err, rows) => {
      if (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error verifying OTP" });
      } else {
        if (rows.length === 1) {
          // Valid OTP
          res.json({ success: true, message: "OTP verified successfully" });
        } else {
          // Invalid OTP
          res.status(400).json({ success: false, message: "Invalid OTP" });
        }
      }
    }
  );
});


// Forgot password functionality
app.post('/check-user', (req, res) => {
  const { email } = req.body;

  const query = `
    SELECT email FROM registerationdata WHERE email = ?
    UNION
    SELECT email FROM policeregisteration WHERE email = ?
  `;

  mysqlConnection.query(query, [email, email], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'An error occurred' });
    }

    const exists = results.length > 0;
    res.json({ exists });
  });
});



// Reset password endpoint
app.post('/reset-password', (req, res) => {
  const { email, role, newPassword } = req.body;

  let tableName;

  if (role === 'citizen') {
    tableName = 'registerationdata';
  } else if (role === 'police') {
    tableName = 'policeregisteration';
  } else {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Hash the new password
  bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).json({ error: 'An error occurred' });
    }

    const updatePasswordQuery = `UPDATE ${tableName} SET password = ? WHERE email = ?`;

    mysqlConnection.query(updatePasswordQuery, [hashedPassword, email], (err, result) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).json({ error: 'An error occurred' });
      } else if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      } else {
        return res.sendStatus(200);
      }
    });
  });
});








// Approve police accounts
app.get('/pending-accounts', (req, res) => {
  const query = `SELECT id, email FROM policeregisteration WHERE approve = 0 ORDER by id DESC`;

  mysqlConnection.query(query, (error, results) => {
    if (error) {
      console.error('Error executing MySQL query:', error);
      res.status(500).json({ success: false, error: 'An error occurred while fetching pending accounts.' });
    } else {
      res.status(200).json({ success: true, policeList: results });
    }
  }); 
});

// Update approval status
app.put('/approval/:id', (req, res) => {
  const { id } = req.params;
  const { approval } = req.body;

  const updateQuery = `UPDATE policeregisteration SET approve = ? WHERE id = ?`;
  mysqlConnection.query(updateQuery, [approval, id], (error, _) => {
    if (error) {
      console.error('Error executing MySQL query:', error);
      res.status(500).json({ success: false, error: 'An error occurred while updating approval status.' });
    } else {
      res.status(200).json({ success: true });
    }
  });
});





// for submission of feedback
app.post("/submit_feedback", async (req, res) => {
  // saving feedback
  const { feedback } = req.body;

  try {
    let insertQuery = "INSERT INTO feedbacks(content) values( ?);";
    mysqlConnection.query(insertQuery, [feedback], function (error, data) {
      if (error) return res.status(200).json({ message: "server error" });
      return res.status(200).json({ message: "feedback saved" });
    });
  } catch (error) {
    console.log("error while giving feedback: %s", error);
    return res.status(200).json({ message: "failed to save feedback" });
  }
});

app.get("/home", (req, res) => {
  return res.status(200).json({ message: "failed to save feedback" });
});


//  Delete Feedback
app.post("/deleteRecord", async (req, res) => {
  const { feedback_id } = req.body;
  try {
    const [rows] = mysqlConnection.query(
      `DELETE FROM feedbacks WHERE feedback_id = ?`,
      [feedback_id]
    );
    res.json({ success: true, rowsAffected: rows.affectedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});


//  Registration of Citizens
app.post("/register_user", async (req, res) => {
  const { email, username, password, gender, role, cnic } = req.body;
  const hashOfPassword = await bcrypt.hash(password, bcrypt.genSaltSync(10));

  const query = "SELECT email FROM RegisterationData WHERE EMAIL = ?";
  mysqlConnection.query(query, [email], function (error, queryResult) {
    if (error) {
      return res.status(200).json({ message: "internal server error 500" });
    }

    if (queryResult.length) {
      return res.status(200).json({ message: "emailExists" });
    }

    const getFromDB =
      "INSERT INTO RegisterationData(email, username, cnic, gender,role, password) VALUES(?, ?, ?, ?, ?, ?);";
    mysqlConnection.query(
      getFromDB,
      [email, username, cnic, gender, role, hashOfPassword],
      function (error, queryResult) {
        if (error) {
          return res
            .status(200)
            .json({ message: "internal server error 500, getFromDB" });
        }
        return res.status(200).json({ message: "Registerd Successfully!" });
      }
    );
  });
});

// Admin registration for first time
app.post("/register_admin", async (req, res) => {
  const { email, username, password, gender, role, cnic } = req.body;
  const hashOfPassword = await bcrypt.hash(password, bcrypt.genSaltSync(10));

  const query = "SELECT email FROM registeradmin WHERE EMAIL = ?";
  mysqlConnection.query(query, [email], function (error, queryResult) {
    if (error) {
      return res.status(200).json({ message: "internal server error 500" });
    }

    if (queryResult.length) {
      return res.status(200).json({ message: "email Exists" });
    }

    const getFromDB =
      "INSERT INTO registeradmin(email, username, cnic, gender,role, password) VALUES(?, ?, ?, ?, ?, ?);";
    mysqlConnection.query(
      getFromDB,
      [email, username, cnic, gender, role, hashOfPassword],
      function (error, queryResult) {
        if (error) {
          return res
            .status(200)
            .json({ message: "internal server error 500, getFromDB" });
        }
        return res.status(200).json({ message: "Registerd Successfully!" });
      }
    );
  });
});


// Register Ploice to database
app.post("/register_police", async (req, res) => {
  const { email, username, password, gender, role, cnic } = req.body;
  const hashOfPassword = await bcrypt.hash(password, bcrypt.genSaltSync(10));

  const query = "SELECT email FROM policeregisteration WHERE EMAIL = ?";
  mysqlConnection.query(query, [email], function (error, queryResult) {
    if (error) {
      return res.status(200).json({ message: "internal server error 500" });
    }

    if (queryResult.length) {
      return res.status(200).json({ message: "Email Exists" });
    }

    const approval = false;

    const insertQuery =
      "INSERT INTO policeregisteration (email, username, cnic, gender, role, password, approve) VALUES (?, ?, ?, ?, ?, ?, ?);";
    mysqlConnection.query(
      insertQuery,
      [email, username, cnic, gender, role, hashOfPassword, approval],
      function (error, _) {
        if (error) {
          return res.status(500).json({ message: "Internal Server Error" });
        }
        return res.status(200).json({ message: "Registered Successfully!" });
      }
    );
  });
});


// Citizen login in the system
app.post("/user_login", async (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT email FROM RegisterationData WHERE email = ?";

  mysqlConnection.query(query, [email], function (error, queryResult) {
    if (error) {
      return res.status(200).json({ message: "internal server error 500" });
    }

    if (!queryResult.length)
      return res.status(200).json({ message: "Sorry! You are not registered" });

    const getFromDB = "SELECT password FROM RegisterationData WHERE email = ?";

    mysqlConnection.query(getFromDB, [email], function (error, queryResult) {
      if (error) {
        return res
          .status(200)
          .json({ message: "internal server error 500, getFromDB" });
      }

      if (!queryResult.length)
        return res.status(200).json({ message: "user is not registered" });

      const dbPassword = queryResult[0]?.password;

      const isPasswordValid = bcrypt.compareSync(password, dbPassword);

      // if true then give user an id
      const token = jwt.sign(email, process.env.JWT_SECRET);
      return isPasswordValid
        ? res.status(200).json({ message: "reged", token })
        : res.status(200).json({ message: "invalid credentails" });
    });
  });
});
// Admin Login
app.post("/admin_login", async (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT email FROM registeradmin WHERE email = ?";

  mysqlConnection.query(query, [email], function (error, queryResult) {
    if (error) {
      return res.status(200).json({ message: "internal server error 500" });
    }

    if (!queryResult.length)
      return res.status(200).json({ message: "Sorry! You are not registered" });

    const getFromDB = "SELECT password FROM registeradmin WHERE email = ?";

    mysqlConnection.query(getFromDB, [email], function (error, queryResult) {
      if (error) {
        return res
          .status(200)
          .json({ message: "internal server error 500, getFromDB" });
      }

      if (!queryResult.length)
        return res.status(200).json({ message: "user is not registered" });

      const dbPassword = queryResult[0]?.password;

      const isPasswordValid = bcrypt.compareSync(password, dbPassword);

      // if true then give user an id 
      const token = jwt.sign(email, process.env.JWT_SECRET);
      return isPasswordValid
        ? res.status(200).json({ message: "reged", token })
        : res.status(200).json({ message: "invalid credentails" });
    });
  });
});
// Police login in the system 
app.post("/police_login", async (req, res) => {
  const { email, password } = req.body;
  const query = "SELECT email, password, approve FROM policeregisteration WHERE email = ?";

  mysqlConnection.query(query, [email], function (error, queryResult) {
    if (error) {
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (!queryResult.length)
      return res.status(200).json({ message: "Sorry! You are not registered" });

    const dbPassword = queryResult[0]?.password;
    const approve = queryResult[0]?.approve;

    const isPasswordValid = bcrypt.compareSync(password, dbPassword);

    if (isPasswordValid) {
      const token = jwt.sign(email, process.env.JWT_SECRET);
      return res.status(200).json({ message: "reged", approve, token });
    } else {
      return res.status(200).json({ message: "Invalid credentials" });
    }
  });
});

// Posting the news
app.post("/submit_news", async (req, res) => {
  let { headline, details } = req.body;
  const postQuery = "INSERT INTO news(headline, details) values( ?, ?);";
  try {
    mysqlConnection.query(
      postQuery,
      [headline, details],
      function (error, data) {
        if (error) {
          console.log("errror in submit news" + error);
          return res.status(200).json({ message: "server error" });
        }
        return res.status(200).json({ message: "News posted successfully" });
      }
    );
  } catch (error) {
    console.log("error while posting news: %s", error);
    return res.status(200).json({ message: "failed to save news" });
  }
});

// To Report a crime
app.post("/crime_report", async (req, res) => {
  let { image_url, description, crimeType, location, token } = req.body;

  if (!image_url) image_url = "NA";
  if (!crimeType) crimeType = "NA";
  if (!description) description = "NA";
  if (!location) location = "NA";

  const insertQuery =
    "INSERT INTO CRIMEREPORT (token, location, description, type, image) VALUES(?, ?, ?, ?, ?);";

  try {
    mysqlConnection.query(
      insertQuery,
      [token, location, description, crimeType, image_url],
      function (error, result) {
        if (error) return console.log("error saving image: %s", error);
        return res.status(200).json({ message: "ُSaved" });
      }
    );
  } catch (error) {
    console.log("error saving image file");
    return res.status(200).json({ message: "SAVED" });
  }
});

//  to post the data of criminals
app.post("/criminal_record", async (req, res) => {
  let { image_url, name, lname, age, nationality, crime, token } = req.body;

  if (!image_url) image_url = "NA";
  if (!name) name = "NA";
  if (!lname) lname = "NA";
  if (!age) age = "NA";
  if (!nationality) nationality = "NA";
  if (!crime) crime = "NA";

  const insertQuery =
    "INSERT INTO criminals_record (token, name, lname, age, nationality, crime, image) VALUES(?, ?, ?, ?, ?, ? ,?);";

  try {
    mysqlConnection.query(
      insertQuery,
      [token, name, lname, age, nationality, crime, image_url],
      function (error, result) {
        if (error) return console.log("error saving image: %s", error);
        return res.status(200).json({ message: "ُSaved" });
      }
    );
  } catch (error) {
    console.log("error saving image file");
    return res.status(200).json({ message: "SAVED" });
  }
});

//  Accessing the crime reported by the citizen
app.get("/get_crime", async (req, res) => {
  try {
    const getCrimes = "SELECT id, description, location, type, image, status FROM crimereport ORDER BY id DESC";
    mysqlConnection.query(getCrimes, function (err, data) {
      if (err) {
        console.log("Error while getting crimes:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      const queryObject = data.map(row => ({
        id: row.id,
        description: row.description,
        location: row.location,
        type: row.type,
        image: row.image, 
        status: row.status
      }));

      
      return res.status(200).json({ message: "success", data: queryObject });
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  } 
});
// update status of crime 
app.post("/update_status", async (req, res) => {
  const { crimeId, status } = req.body;

  try {
    const updateStatusQuery = "UPDATE crimereport SET status = ? WHERE id = ?";
    mysqlConnection.query(updateStatusQuery, [status, crimeId], function (err, result) {
      if (err) {
        console.log("Error while updating status:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
 
      return res.status(200).json({ message: "success" });
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});




app.post("/get_my_complaints", async (req, res) => {
  const { token } = req.body;

  let queryObject = [];
  let userComplaints = [];
 
  try {
    const getCrimes = "SELECT * FROM crimereport ORDER BY id DESC";

    mysqlConnection.query(getCrimes, function (err, data) {
      if (err) {
        return console.log("Error while getting crimes");
      }
 
      for (let row of data) queryObject.push(row);

      const { email } = jwt.decode(token);

      queryObject.forEach((item) => {
        if (item.token) { 
          let db_email = jwt.decode(item.token);
          if (db_email.email === email) userComplaints.push(item);
        }
      });

      return res
        .status(200)
        .json({ message: "success", result: userComplaints });
    });
  } catch (err) {
    console.log(err);
  }
});

// To view all criminals by citizen
app.get("/view_criminals", async (req, res) => {
  let queryObject = [];
  try {
    const getCrimes = "SELECT * FROM criminals_record ORDER BY id DESC";
    mysqlConnection.query(getCrimes, function (err, data) {
      if (err) {
        return console.log("Error while getting criminal records");
      }

      for (let row of data) queryObject.push(row);
      return res.status(200).json({ message: "success", data: queryObject });
    });
  } catch (err) {
    console.log(err);
  }
});



// Accessing data of feedback to view by admin

app.get("/get_feedbacks", async (req, res) => {
  let queryObject = [];
  try {
    const getFeeds = "SELECT * FROM feedbacks ORDER BY feedback_id DESC";
    mysqlConnection.query(getFeeds, function (err, data) {
      if (err) {
        return console.log("Error while getting feebacks");
      }

      for (let row of data) queryObject.push(row);
      return res.status(200).json({ message: "success", data: queryObject });
    });
  } catch (err) { 
    console.log(err); 
  }   
}); 

// Accessing the news to be viewed by user admin and citizen
app.get("/get_news", async (req, res) => { 
  let queryObject = [];
  try {
    const getNews = "SELECT * FROM news ORDER BY news_id DESC";
    mysqlConnection.query(getNews, function (err, data) {
      if (err) {
        return console.log("Error while getting feebacks");
      }

      for (let row of data) queryObject.push(row);
      return res.status(200).json({ message: "success", data: queryObject });
    });
  } catch (err) {
    console.log(err);
  }
});     

app.listen(3001, () => console.log("server up "));
   