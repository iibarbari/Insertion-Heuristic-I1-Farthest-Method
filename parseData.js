const fs = require('fs').promises;

const calculateDestination = (x1, x2, y1, y2) => {
  return Number(Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2).toFixed(0));
};

const getDistanceData = (data) => {
  const distanceData = [];

  data.forEach((fromCustomer, i) => {
    distanceData.push([]);
    for (let toCustomer = 0; toCustomer < [...Array(data.length).keys()].length; toCustomer++) {
      if (i !== toCustomer) {
        const toCustomerX = data[toCustomer].x;
        const toCustomerY = data[toCustomer].y;
        distanceData[i].push({
          from: i,
          to: toCustomer,
          length: calculateDestination(toCustomerX, toCustomerY, fromCustomer.x, fromCustomer.y),
        });
      } else {
        distanceData[i].push({
          from: i,
          to: toCustomer,
          length: 0,
        });
      }
    }
  });

  return distanceData;
};

module.exports = async ({ fileName, customerLoc, distanceLoc }) => {
  const customerData = [];
  let file = await fs.readFile(fileName, 'utf8');

  file = await file.toString().split('\r\n');
  file.forEach((data, i) => {
    if (i >= 9) {
      data = data.trim().split(/\s+/g);
      customerData.push({
        customer: Number(data[0]),
        x: Number(data[1]),
        y: Number(data[2]),
        demand: Number(data[3]),
        readyTime: Number(data[4]),
        due: Number(data[5]),
        availableTime: Number(data[5]) - Number(data[4]),
        serviceTime: Number(data[6]),
      });
    }
  });

  await fs.writeFile(customerLoc, JSON.stringify(customerData), 'utf8');
  await fs.writeFile(distanceLoc, JSON.stringify(getDistanceData(customerData)), 'utf8');
};
