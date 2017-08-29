//Require packages
var mysql = require('mysql');
var inquirer = require('inquirer');

//create database connection
var connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'bamazon'
});

// Intializing database snapshot and currentItem variable
var snapshot;
var currentItem = {};

// Testing database connection prior to taking db snapshot
testConnection();

// If connection is successful, take a database snapshot.
function testConnection() {
  connection.connect(function (err) {
    if (err) {
      console.log('Unable to connect to the Bamazon database. Please contact your network administrator.');
    } else {
      getDatabaseSnapshot();
    }
  });
}
// Get database snapshot to be used for user prompt.
function getDatabaseSnapshot() {
  connection.query('SELECT * FROM products', function(err, data) {
    if (err) {
      console.log(err);
    } else {
      snapshot = data;
      promptUserForSelection();
    }
  });
}

// Prompt user to select which item they want and what quantity
function promptUserForSelection() {
  inquirer.prompt(
      [
        {
          name: 'item',
          type: 'list',
          message: 'Which item would you like to purchase?',
          choices: function () {
            return snapshot.map(function (item) {
              return item.item_id + ' | ' + item.product_name + ' | Price: $' + item.price + ' | Quantity Available: ' + item.stock_quantity;
            });
          }
        },
        {
          name: 'quantity',
          type: 'input',
          message: function(answers) {
            return 'What quantity would you like to purchase of ' + answers.item.split(' | ')[1] + '? ' + answers.item.split(' | ')[3];
          },
          validate: function(answer) {
            var pattern = /^\d+$/;
            if (pattern.test(answer)) {
              return true;
            } else {
              return 'Please enter a valid number.';
            }
          }
        }
      ]
  ).then(
      function(answers) {

        currentItem.item_id = parseInt(answers.item.split(' | ')[0], 10);
        currentItem.product_name = answers.item.split(' | ')[1];
        currentItem.price = parseFloat(answers.item.split(' | ')[2].split('$')[1]);
        currentItem.quantity_requested = parseInt(answers.quantity, 10);


        checkDatabaseQuantity();
      }
  );
}

// Check quantity to see if requested quantity is available
function checkDatabaseQuantity() {
  connection.query('SELECT stock_quantity FROM products WHERE item_id = ?', currentItem.item_id, function(err, data) {
    if (err) {
      console.log(err);
    } else {
      if (currentItem.quantity_requested <= data[0].stock_quantity) {
        updateDatabase(data[0].stock_quantity);
      } else {
        sendQuantityAlert(data[0].stock_quantity);
      }
    }
  });
}

// If stock quantity is greater than amount requested process request and decrement stock
function updateDatabase(quantity) {
  connection.query('UPDATE products SET stock_quantity = ? WHERE item_id = ?',
      [quantity - currentItem.quantity_requested, currentItem.item_id], function(err, data) {
        if (err) {
          console.log(err);
        } else {
          returnTotalToUser();
        }
      });
}

// If there is not enough stock, alert user with current quantity and restart purchase process.
function sendQuantityAlert(quantity) {
  console.log('Sorry, insufficient quantity. Remaining quantity: %s', quantity);
  setTimeout(getDatabaseSnapshot, 1500);
}

// Display total sale and as if user wants to make additional purchases.
function returnTotalToUser() {
  var total = currentItem.price * currentItem.quantity_requested;
  console.log('Purchase successful! Your total: $%s', total);
  setTimeout(promptForAdditionalPurchases, 1500);
}

// If user wants to continue with purchases, restart process, otherwise display final greeting.
function promptForAdditionalPurchases() {
  inquirer.prompt({
    name: 'continue',
    type: 'confirm',
    message: 'Would you like to make another purchase?'
  }).then(
      function(answers) {
        if (answers.continue) {
          currentItem = {};
          getDatabaseSnapshot();
        } else {
          console.log('Thank you, have a great day!');
          connection.end();
        }
      }
  );
}