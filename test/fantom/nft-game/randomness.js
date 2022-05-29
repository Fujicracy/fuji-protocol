const { ethers } = require("hardhat");
const { expect } = require("chai");
const { WrapperBuilder } = require("redstone-evm-connector");

const { syncTime, LIB_PSEUDORANDOM } = require("../utils");

const DEBUG = true;

const RANDOM_LIBRARY_LOWER_LIMIT = ethers.BigNumber.from("0");;
const RANDOM_LIBRARY_UPPER_LIMIT = ethers.BigNumber.from("1000001");

const createRanges = function (lowvalue, highvalue, numberOfRanges) {
  const rangeSize = (highvalue - lowvalue) / numberOfRanges;
  let buildranges = [];
  let temp = 0;
  for (let index = 1; index < numberOfRanges + 1; index++) {
    buildranges.push(
      {
        lowLimit: temp,
        upLimit: Math.ceil(temp + rangeSize),
        frequency: 0
      }
    );
    temp = Math.ceil(temp + rangeSize);
  }
  return buildranges;
}

const countDistribution = function (arrayOfNumbers, ranges) {
  let distribution = ranges;
  arrayOfNumbers.forEach(number => {
    for (let index = 0; index < distribution.length; index++) {
      if (number > distribution[index].lowLimit && number <= distribution[index].upLimit) {
        distribution[index].frequency += 1;
      }
    }
  });
  return distribution;
}


describe("Randomness Unit Tests", function () {

  let MockRandomTests;
  let mockrandom;
  let wrappedmockrandom;

  before(async function () {

    await syncTime();

    MockRandomTests = await ethers.getContractFactory(
      "MockRandomTests",
      {
        libraries: {
          LibPseudoRandom: LIB_PSEUDORANDOM, // fantom
        }
      }
    );
    mockrandom = await MockRandomTests.deploy([]);
    await mockrandom.setMaxEntropyDelay(3*60);
    wrappedmockrandom = WrapperBuilder
      .wrapLite(mockrandom)
      .usingPriceFeed("redstone", { asset: "ENTROPY" });

    await wrappedmockrandom.authorizeSignerEntropyFeed("0x0C39486f770B26F5527BBBf942726537986Cd7eb");
  });

  beforeEach(async function () {
    await syncTime();
  });

  it("Should return an entropy value from redstone", async function () {

    const entropyValue = await wrappedmockrandom.getEntropyTest();
    if (DEBUG) {
      console.log("entropyValue", entropyValue.toString());
    }
    expect(entropyValue).to.be.gt(0);
  });

  it("Should return a random value in range = [1 , 1000000]", async function () {
    const randomNumber = await wrappedmockrandom.getOneRandomNumberTest();
    if (DEBUG) {
      console.log("randomNumber", randomNumber.toString());
    }
    expect(randomNumber).to.be.gt(RANDOM_LIBRARY_LOWER_LIMIT);
    expect(randomNumber).to.be.lt(RANDOM_LIBRARY_UPPER_LIMIT)
  });

  it("Should return multiple random values in range = [1 , 1000000]", async function () {
    const requestAmountOfNumbers = 1000;

    const randomNumbers = await wrappedmockrandom.getManyRandomNumbersTest(requestAmountOfNumbers);

    expect(randomNumbers.length).to.eq(requestAmountOfNumbers);

    if (DEBUG) {
      randomNumbers.forEach(element => {
        console.log('RandomNumber', element.toString());
      });
    }

    randomNumbers.forEach(element => {
      expect(element).to.be.gt(RANDOM_LIBRARY_LOWER_LIMIT);
      expect(element).to.be.lt(RANDOM_LIBRARY_UPPER_LIMIT)
    });

  });

  it("Should demonstrate all values have close-to-equal chance of outcome", async function () {
    const requestAmountOfNumbers = 5000;
    const numberOfDesiredRanges = 10;

    const randomNumbers = await wrappedmockrandom.getManyRandomNumbersTest(requestAmountOfNumbers);
    const randomAsIntegers = randomNumbers.map(each => each.toNumber());

    const ranges = createRanges(1, 1e6, numberOfDesiredRanges);
    const testDistribution = countDistribution(randomAsIntegers, ranges);

    let outcomes = 0;
    for (let index = 0; index < testDistribution.length; index++) {
      outcomes += testDistribution[index].frequency;
    }

    console.log("result distribution", testDistribution);

    expect(outcomes).to.eq(requestAmountOfNumbers);

  });



})