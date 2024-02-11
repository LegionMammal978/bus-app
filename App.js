import React, {useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Text, View} from 'react-native';
import {getUgaData, getAccData, getArrivals} from './fetch';

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
      const arrivals = foreach
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
              {item.route}, {item.date}
            </Text>
          )}
        />
      )}
    </View>
  );
};

export default App;
