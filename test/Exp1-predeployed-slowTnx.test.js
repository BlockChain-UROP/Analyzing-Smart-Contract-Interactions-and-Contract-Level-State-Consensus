const { getNow } = require("./helper/timer");
const { sleep, writeToFile, readCsvIntoAddresses } = require("./helper/util");
const fs=require('fs');

const Custodian = artifacts.require("Custodian");
const Client = artifacts.require("Client");

let clients = []; // array of client contracts 
let consensus = {};
let events;

let t1 = []; 
let t2 = [];
let max_trial = 20;
let N = 100;    // fixed N clients
let M = 1;    // max custodians
let T = 100;

let timerOn = false;



contract('Custodian', function (accounts) {

    context('N voters', function () {
        it("Exp", async function(){

            // Create client
            clients = [];

            // Load all Client addresses on Kovan
            var addresses = await readCsvIntoAddresses('experiments/client_addr.csv');
            console.log(addresses);
            console.log(addresses.length,"clients found");

            // Check whether client number read 100
            if (addresses.length >= N) {
                for (var n = 0; n<N; n++){
                    clients[n] = await Client.at(addresses[n]);
                }
            } else {
                var diff = N - addresses.length;
                console.log("Need",N,"more clients");
                var n = 0;
                for (n = 0; n<addresses.length; n++){
                    clients[n] = await Client.at(addresses[n]);
                }
                for (n=addresses.length; n<N; n++){
                    clients[n] = await Client.new();
                }
            }

            // Test different number of N
            for (var n = 10; n<=N; n+=10) {

                let ans_array_per_n = [];

                // Do multiple trials
                for (var j = 0; j<max_trial; j++){

                    consensus[0] = await Custodian.new();

                    // extend voter base to n
                    for (var _n = 0; _n<n; _n++){
                        await clients[_n].vote(consensus[0].address, true);  // HAS AWAIT
                    }
                    assert.equal(await consensus[0].numOfTotalVoterClients(), n);

                    // start!
                    t1[n] = await getNow();
                    timerOn = true;

                    // Event
                    events = consensus[0].allEvents(["latest"]);
                    events.watch(async function(error, event){
                        if (!error) {

                            if (timerOn) {
                                t2[n] = await getNow(); 
                                timerOn = false;
                            }

                        } else { console.log(error); }
                    });

                    // terminate all camps for each consensus before start another vote camp
                    await consensus[0].unsafeTerminateCurrentOpenedSeq();

                    // all client votes
                    for (var i = 0; i < n; i++) { 
                        clients[i].vote(consensus[0].address, false); 
                        await sleep(100);
                    }
                
                    await sleep(3000);
                    assert.equal(await consensus[0].numOfTotalVoterClients(), n);

                    cur_ans = t2[n] - t1[n];
                    console.log(n, ":", t2[n], t1[n], cur_ans);
                    ans_array_per_n.push(cur_ans);
                }
                // Output to file (m:time)
                writeToFile("Exp1-"+n.toString(), ans_array_per_n);
            }
        }).timeout(999999999999);
    });
});