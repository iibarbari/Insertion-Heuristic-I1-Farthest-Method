const fs = require('fs');
const parseData = require('./parseData');

// params
const self = {
  routes: [],
  route: [],
  vehicleCapacity: 50,
  vehicle: 25,
  msg: {
    vehicleCount: 'Vehicle count has exceeded for route ',
    vehicleCapacity: 'Vehicle capacity has exceeded for route ',
    schedule: 'Schedule issue for route ',
    initialRoute: 'Initial route created ',
    newNode: 'New node added to the current route',
    end: 'No nodes left',
  },
  fileOptions: {
    fileName: './Instances/c106_10.txt',
    customerLoc: './data/customer.json',
    distanceLoc: './data/distance.json',
  },
  outputFile: './output.json',
  showErrors: true,
};

// Number
self.findDistanceBetweenNodes = (a, b) => {
  return Number(self.distanceData[a][b].length);
};

// Object => { node: {due, readyTime, arrival. departure}}
self.calculateRouteTime = (route) => {
  const schedule = [];

  route.forEach((node, index) => {
    const { readyTime, due, serviceTime } = self.customerData[node];

    if (index > 0) {
      const currentTime = (schedule[index - 1] || {}).departure || 0;
      const travelTime = self.findDistanceBetweenNodes(node, route[index - 1]);
      const arrival = readyTime < currentTime + travelTime ? currentTime + travelTime : readyTime;

      schedule.push({
        node,
        due,
        readyTime,
        travelTime,
        arrival,
        departure: arrival + serviceTime,
      });
    } else {
      schedule.push({
        node,
        due,
        readyTime,
        travelTime: 0,
        arrival: 0,
        departure: 0,
      });
    }
  });

  return schedule;
};

// Updates global data
self.updateVisitedRoutes = () => {
  const visitedByOtherVehicles = self.routes.reduce((acc, curr) => {
    return acc.concat(curr);
  }, []);

  const visitedRoutes = visitedByOtherVehicles.concat(self.route).filter((i) => i !== 0);

  self.unVisitedNodes = [...Array(self.customerData.length).keys()].filter((node) => visitedRoutes.indexOf(node) < 0);
};

// Object -> {from: 0, to: 2, length: 70}
self.createInitialRoute = () => {
  const tempDistanceData = self.distanceData[0];

  const farthestNode = tempDistanceData
    .filter((node) => self.unVisitedNodes.indexOf(node.to) > 0 || node.to === 0)
    .reduce((prev, current) => {
      return prev.length > current.length ? prev : current;
    });

  console.warn(self.msg.initialRoute, [0, farthestNode.to, 0]);
  self.route.push(0, farthestNode.to, 0);
};

// Boolean
self.checkTimeConstraint = (route) => {
  const schedule = self.calculateRouteTime(route);
  const isFeasible =
    schedule
      .map((obj) => {
        const { due, readyTime, arrival } = obj;

        return arrival <= due && arrival >= readyTime;
      })
      .indexOf(false) < 0;

  return isFeasible;
};

// Boolean
self.checkVehicleCapacityConstraint = (route) => {
  return (
    route.reduce((prev, current) => {
      return prev + self.customerData[current].demand;
    }, 0) < self.vehicleCapacity
  );
};

// Boolean
self.checkVehicleCountConstraint = () => self.routes.length < self.vehicle;

// Boolean
self.checkConstraints = (route) => {
  const isFeasible =
    self.checkVehicleCapacityConstraint(route) && self.checkTimeConstraint(route) && self.checkVehicleCountConstraint();
  if (self.showErrors) {
    if (!self.checkVehicleCapacityConstraint(route)) {
      console.warn(self.msg.vehicleCapacity, route);
    } else if (!self.checkTimeConstraint(route)) {
      console.warn(self.msg.schedule, route);
    } else if (!self.checkVehicleCountConstraint()) {
      console.warn(self.msg.vehicleCount, route);
    }
  }

  return isFeasible;
};

// Array -> [0, 2, 1, 0]
self.chooseTheFarthestRoute = (routes) => {
  const f2Values = [];

  routes.forEach((route) => {
    const addedNode = route.filter((node) => self.route.indexOf(node) < 0)[0];
    const fromNode = route[route.indexOf(addedNode) - 1];
    const toNode = route[route.indexOf(addedNode) + 1];

    const f1 =
      self.findDistanceBetweenNodes(fromNode, addedNode) +
      self.findDistanceBetweenNodes(toNode, addedNode) -
      self.findDistanceBetweenNodes(fromNode, toNode);
    const f2 = self.findDistanceBetweenNodes(0, addedNode) - f1;

    f2Values.push({
      f2,
      route,
    });
  });

  return f2Values.reduce((prev, current) => {
    return prev.f2 > current.f2 ? prev : current;
  }, {}).route;
};

// Updates global data
self.addNode = () => {
  let index = 1;
  let possibleRoutes = [];
  const tempRoute = self.route;

  while (index < tempRoute.length) {
    for (let i = 0; i < self.unVisitedNodes.length; i++) {
      if (self.unVisitedNodes[i] !== 0) {
        const newRoute = [tempRoute.slice(0, index), self.unVisitedNodes[i], tempRoute.slice(index)];

        const parsedNewRoute = newRoute
          .join()
          .split(',')
          .map((str) => Number(str));

        possibleRoutes.push(parsedNewRoute);
      }
    }
    index++;
  }

  possibleRoutes = possibleRoutes.filter((route) => self.checkConstraints(route));

  if (possibleRoutes.length > 0) {
    self.route = self.chooseTheFarthestRoute(possibleRoutes);

    console.warn(self.msg.newNode, self.route);
  } else {
    self.createNewVehicle();
  }
};

self.createNewVehicle = () => {
  self.routes.push(self.route);
  self.route = [];
  console.log('New vehicle opened');
  self.createInitialRoute();
};

self.prepareDetailedOutput = () => {
  const output = [];
  self.routes.forEach((route) => {
    output.push({
      route,
      time: self.calculateRouteTime(route),
      demand: route.reduce((prev, current) => {
        return prev + self.customerData[current].demand;
      }, 0),
    });
  });

  output.push({
    numberOfUsedVehicles: self.routes.length,
    unVisitedNodes: self.unVisitedNodes.filter((i) => i !== 0),
  });

  return output;
};

self.init = async () => {
  await parseData(self.fileOptions);

  self.customerData = await require(self.fileOptions.customerLoc);
  self.distanceData = await require(self.fileOptions.distanceLoc);

  self.unVisitedNodes = await [...Array(self.customerData.length).keys()];

  self.createInitialRoute();
  self.updateVisitedRoutes();

  while (self.unVisitedNodes.length > 1 && self.routes.length <= self.vehicle - 1) {
    self.addNode();
    self.updateVisitedRoutes();
  }

  if (self.unVisitedNodes.length > 1) {
    console.log(
      self.msg.vehicleCount,
      self.unVisitedNodes.filter((i) => i !== 0)
    );
  } else {
    console.log(self.msg.end);
  }

  if (self.routes.length <= self.vehicle - 1) {
    self.routes.push(self.route);
  }

  const data = JSON.stringify(self.prepareDetailedOutput());

  fs.writeFile(self.outputFile, data, (err) => {
    if (err) throw err;
    console.log('Data written to file');
  });
};

self.init();
