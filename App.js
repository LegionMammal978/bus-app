import React, {useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Text, View} from 'react-native';
import {geoDistanceFt, getUgaData, getAccData, getArrivals} from './fetch';

const App = () => {
  const [isLoading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  const getStops = async () => {
    try {
      const uga = await getUgaData();
      const acc = await getAccData();
      const routes = [...uga.routes.values(), ...acc.routes.values()];
      const vehicles = [...uga.vehicles.values(), ...acc.vehicles.values()];
      const stops = [...uga.stops.values(), ...acc.stops.values()];
      const userPos = [33.951675, -83.376325];
      const maxDistanceFt = 0.5 * 5280;
      const mphToFtps = 22 / 15;
      const walkingSpeedFtps = 3 * mphToFtps;
      for (const stop of stops)
        stop.distanceFt = geoDistanceFt(userPos, stop.pos);
      const sortedStops = stops.filter(stop => stop.distanceFt <= maxDistanceFt);
      sortedStops.sort((stop1, stop2) => stop1.distanceFt - stop2.distanceFt);
      const arrivals = [];
      for (const stop of sortedStops) {
        const minOffsetSec = stop.distanceFt / walkingSpeedFtps;
        arrivals.push(...await getArrivals(uga, acc, stop, minOffsetSec));
      }
      arrivals.sort((arrival1, arrival2) => arrival1.date - arrival2.date);
      /*
      const arrivalStops = new Map();
      for (const arrival of arrivals) {
        if (!arrivalStops.has(arrival.stop.id))
          arrivalStops.set(arrival.stop.id, []);
        arrivalStops.get(arrival.stop.id).push(arrival);
      }
      */
      //const response = await fetch('https://routes.uga.edu/Route/18724/Direction/2616/Stops');
      //const json = await response.json();
      setData(arrivals);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStops();
  }, []);

  return (
    <View style={{flex: 1, padding: 24}}>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={data}
          keyExtractor={({id}) => id}
          renderItem={({item}) => (
            <Text>
              {JSON.stringify(item.route)}, {item.date.toString()}
            </Text>
          )}
        />
      )}
    </View>
  );
};

export default App;
