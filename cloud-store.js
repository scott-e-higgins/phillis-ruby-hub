(() => {
  const uuid = () => crypto.randomUUID();
  const num = value => value == null ? null : Number(value);
  const time = value => value ? String(value).slice(0, 5) : '';
  const assert = result => {
    if (result.error) throw result.error;
    return result.data || [];
  };

  function createStore(cloud) {
    const { client, householdId, role } = cloud;
    let known = {};
    let syncing = Promise.resolve();

    async function load() {
      if (role === 'viewer') {
        const rows = assert(await client.rpc('get_family_itinerary_v2'));
        const trips = new Map();
        const stays = [];
        rows.forEach(row => {
          if (!trips.has(row.trip_id)) {
            trips.set(row.trip_id, {
              _cloudId: row.trip_id,
              year: Number(String(row.start_date).slice(0, 4)),
              name: row.trip_name,
              destination: row.destination_name,
              startDate: row.start_date,
              endDate: row.end_date,
              status: 'planned',
              notes: '',
              distance: null,
              gallons: 0,
              cost: 0,
              mpg: null
            });
          }
          if (row.campground_name) {
            stays.push({
              _tripId: row.trip_id,
              year: Number(String(row.arrival_date).slice(0, 4)),
              arrival: row.arrival_date,
              departure: row.checkout_date,
              checkInTime: time(row.check_in_time),
              checkOutTime: time(row.check_out_time),
              nights: row.checkout_date ? Math.round((new Date(row.checkout_date) - new Date(row.arrival_date)) / 86400000) : null,
              name: row.campground_name,
              address: row.address || '',
              city: row.city || '',
              state: row.state || '',
              zip: row.postal_code || '',
              site: row.site_number || '',
              price: 0,
              stayType: row.stay_type || 'campground',
              harvestHost: row.stay_type === 'harvest-host',
              moochdocking: row.stay_type === 'moochdocking',
              boondocking: row.stay_type === 'boondocking',
              notes: ''
            });
          }
        });
        return {
          tripSummaries: [...trips.values()],
          stays,
          fuel: [],
          siteFees: [],
          electric: [],
          phillisMaintenance: [],
          phillisUpgrades: [],
          rubyMaintenance: [],
          rubyUpgrades: [],
          meta: { cloud: true, viewer: true }
        };
      }
      const results = await Promise.all([
        client.from('trips').select('*').eq('household_id', householdId),
        client.from('campground_stays').select('*'),
        client.from('trip_fuel').select('*'),
        client.from('vehicles').select('*').eq('household_id', householdId),
        client.from('maintenance').select('*'),
        client.from('seasonal_sites').select('*').eq('household_id', householdId),
        client.from('site_seasons').select('*'),
        client.from('seasonal_payments').select('*'),
        client.from('electric_bills').select('*')
      ]);
      const [trips, stays, fuel, vehicles, maintenance, sites, seasons, payments, electric] = results.map(assert);
      known = {
        trips: new Set(trips.map(x => x.id)),
        campground_stays: new Set(stays.map(x => x.id)),
        trip_fuel: new Set(fuel.map(x => x.id)),
        maintenance: new Set(maintenance.map(x => x.id)),
        site_seasons: new Set(seasons.map(x => x.id)),
        seasonal_payments: new Set(payments.map(x => x.id)),
        electric_bills: new Set(electric.map(x => x.id))
      };

      const tripById = new Map(trips.map(x => [x.id, x]));
      const vehicleById = new Map(vehicles.map(x => [x.id, x]));
      const seasonById = new Map(seasons.map(x => [x.id, x]));
      const site = sites[0] || {};
      const siteLocation = String(site.location || '');
      const siteLocationParts = siteLocation.split(',').map(x => x.trim());
      const siteStateZip = String(siteLocationParts[2] || '').match(/^([A-Z]{2})\s*(.*)$/);
      const fuelByTrip = new Map();
      fuel.forEach(row => {
        if (!fuelByTrip.has(row.trip_id)) fuelByTrip.set(row.trip_id, []);
        fuelByTrip.get(row.trip_id).push(row);
      });

      const tripSummaries = trips.map(row => {
        const rows = fuelByTrip.get(row.id) || [];
        const gallons = rows.reduce((sum, x) => sum + (num(x.gallons) || 0), 0);
        const cost = rows.reduce((sum, x) => sum + (num(x.total_cost) || 0), 0);
        const distance = rows.reduce((sum, x) => sum + (num(x.trip_meter) || 0), 0) || null;
        return {
          _cloudId: row.id,
          year: Number(String(row.start_date).slice(0, 4)),
          name: row.name,
          destination: row.destination_name,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
          notes: row.notes || '',
          distance,
          gallons,
          cost,
          mpg: gallons && distance ? distance / gallons : null
        };
      });

      const tripName = id => tripById.get(id)?.name || '';
      const localStays = stays.map(row => ({
        _cloudId: row.id,
        _tripId: row.trip_id,
        year: Number(String(row.arrival_date).slice(0, 4)),
        arrival: row.arrival_date,
        departure: row.checkout_date,
        checkInTime: time(row.check_in_time),
        checkOutTime: time(row.check_out_time),
        nights: row.checkout_date ? Math.round((new Date(row.checkout_date) - new Date(row.arrival_date)) / 86400000) : null,
        name: row.campground_name,
        address: row.address || '',
        city: row.city || '',
        state: row.state || '',
        zip: row.postal_code || '',
        site: row.site_number || '',
        price: num(row.cost) || 0,
        stayType: row.stay_type || '',
        harvestHost: row.stay_type === 'harvest-host',
        moochdocking: row.stay_type === 'moochdocking',
        boondocking: row.stay_type === 'boondocking',
        notes: row.notes || ''
      }));

      seasons.forEach(season => {
        localStays.push({
          _cloudId: season.id,
          _seasonId: season.id,
          year: Number(season.year),
          arrival: 'Season',
          departure: 'Season',
          nights: null,
          name: site.name || 'Seasonal site',
          address: siteLocationParts[0] || siteLocation,
          city: siteLocationParts[1] || '',
          state: siteStateZip?.[1] || '',
          zip: siteStateZip?.[2] || '',
          site: site.site_number || '',
          price: num(season.annual_fee) || 0,
          harvestHost: false,
          notes: season.notes || ''
        });
      });

      const maintenanceGroups = {
        phillisMaintenance: [], phillisUpgrades: [],
        rubyMaintenance: [], rubyUpgrades: []
      };
      maintenance.forEach(row => {
        const vehicle = vehicleById.get(row.vehicle_id);
        const prefix = vehicle?.name === 'Ruby' ? 'ruby' : 'phillis';
        const suffix = row.record_type === 'upgrade' ? 'Upgrades' : 'Maintenance';
        maintenanceGroups[prefix + suffix].push({
          _cloudId: row.id,
          _vehicleId: row.vehicle_id,
          date: row.date,
          description: row.description,
          location: row.vendor || '',
          price: num(row.cost) || 0,
          notes: row.notes || ''
        });
      });

      const siteFees = payments.map(row => ({
        _cloudId: row.id,
        _seasonId: row.season_id,
        year: Number(seasonById.get(row.season_id)?.year),
        date: row.payment_date,
        payment: num(row.amount) || 0,
        check: row.check_number || '',
        notes: row.notes || ''
      }));

      const electricRows = [...electric].sort((a, b) => String(a.bill_date).localeCompare(String(b.bill_date)));
      const priorBySeason = new Map();
      const localElectric = electricRows.map(row => {
        const previous = priorBySeason.get(row.season_id) ?? num(row.meter_reading);
        const current = num(row.meter_reading) || 0;
        priorBySeason.set(row.season_id, current);
        return {
          _cloudId: row.id,
          _seasonId: row.season_id,
          date: row.bill_date,
          previous,
          current,
          usage: current - previous,
          unitPrice: num(row.rate) || 0,
          total: num(row.amount) || 0,
          paid: row.payment_date || '',
          check: row.check_number || '',
          notes: row.notes || ''
        };
      });

      return {
        tripSummaries,
        stays: localStays,
        fuel: fuel.map(row => ({
          _cloudId: row.id,
          _tripId: row.trip_id,
          trip: tripName(row.trip_id),
          date: row.fuel_date,
          station: row.station || '',
          location: row.location || '',
          odometer: num(row.odometer),
          tripMiles: num(row.trip_meter),
          gallons: num(row.gallons) || 0,
          total: num(row.total_cost) || 0,
          price: num(row.gallons) ? num(row.total_cost) / num(row.gallons) : 0,
          fuelType: row.fuel_type || '',
          notes: row.notes || ''
        })),
        siteFees,
        electric: localElectric,
        ...maintenanceGroups,
        meta: { cloud: true }
      };
    }

    const removeMissing = async (table, ids) => {
      const missing = [...(known[table] || [])].filter(id => !ids.has(id));
      if (!missing.length) return;
      assert(await client.from(table).delete().in('id', missing));
    };

    async function write(snapshot) {
      const vehicles = assert(await client.from('vehicles').select('*').eq('household_id', householdId));
      const ruby = vehicles.find(x => x.name === 'Ruby');
      const phillis = vehicles.find(x => x.name === 'Phillis');
      const siteRows = assert(await client.from('seasonal_sites').select('*').eq('household_id', householdId));
      const seasonalSite = siteRows[0];
      if (!ruby || !phillis || !seasonalSite) throw new Error('Ruby, Phillis, or Lehigh Gorge is missing.');

      snapshot.tripSummaries.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const tripRows = snapshot.tripSummaries.map(x => ({
        id: x._cloudId, household_id: householdId, name: x.name,
        destination_name: x.destination || x.name, start_date: x.startDate,
        end_date: x.endDate, status: x.status || 'planned', notes: x.notes || null,
        tow_vehicle_id: ruby.id, rv_id: phillis.id
      }));
      assert(await client.from('trips').upsert(tripRows));
      const tripFor = (name, date) => snapshot.tripSummaries.find(x =>
        x.name === name && (!date || String(x.startDate).slice(0, 4) === String(date).slice(0, 4))
      ) || snapshot.tripSummaries.find(x => x.name === name);
      const tripForStay = stay => snapshot.tripSummaries.find(x =>
        x.startDate <= stay.departure && x.endDate >= stay.arrival
      );

      const ordinaryStays = snapshot.stays.filter(x => x.arrival !== 'Season');
      ordinaryStays.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const stayRows = ordinaryStays.map(x => ({
        id: x._cloudId, trip_id: x._tripId || tripForStay(x)?._cloudId,
        campground_name: x.name, arrival_date: x.arrival, checkout_date: x.departure,
        check_in_time: x.checkInTime || null, check_out_time: x.checkOutTime || null,
        site_number: x.site || null, cost: x.price || 0, address: x.address || null,
        city: x.city || null, state: x.state || null, postal_code: x.zip || null,
        stay_type: x.stayType || (x.harvestHost ? 'harvest-host' : x.moochdocking ? 'moochdocking' : x.boondocking ? 'boondocking' : 'campground'),
        notes: x.notes || null
      })).filter(x => x.trip_id);
      if (stayRows.length) assert(await client.from('campground_stays').upsert(stayRows));

      snapshot.fuel.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const fuelRows = snapshot.fuel.map(x => ({
        id: x._cloudId, trip_id: x._tripId || tripFor(x.trip, x.date)?._cloudId,
        fuel_date: x.date, station: x.station || null, location: x.location || null,
        odometer: x.odometer, trip_meter: x.tripMiles, gallons: x.gallons,
        total_cost: x.total, fuel_type: x.fuelType || (Number(String(x.date).slice(0, 4)) >= 2025 ? 'diesel' : 'gasoline'),
        notes: x.notes || null
      })).filter(x => x.trip_id);
      if (fuelRows.length) assert(await client.from('trip_fuel').upsert(fuelRows));

      const maintSets = [
        ['phillisMaintenance', phillis.id, 'maintenance'], ['phillisUpgrades', phillis.id, 'upgrade'],
        ['rubyMaintenance', ruby.id, 'maintenance'], ['rubyUpgrades', ruby.id, 'upgrade']
      ];
      const maintRows = maintSets.flatMap(([key, vehicleId, recordType]) => snapshot[key].map(x => {
        return { ...(x._cloudId != null ? { id: x._cloudId } : {}), _local: x,
          vehicle_id: vehicleId, date: x.date, description: x.description,
          cost: x.price || 0, vendor: x.location || null, notes: x.notes || null, record_type: recordType };
      }));
      const existingMaint = maintRows.filter(x => x.id != null).map(({ _local, ...row }) => row);
      if (existingMaint.length) assert(await client.from('maintenance').upsert(existingMaint));
      for (const row of maintRows.filter(x => x.id == null)) {
        const local = row._local;
        const { _local, ...insertRow } = row;
        const inserted = assert(await client.from('maintenance').insert(insertRow).select('id').single());
        local._cloudId = inserted.id;
        row.id = inserted.id;
      }

      const seasonEntries = snapshot.stays.filter(x => x.arrival === 'Season');
      seasonEntries.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); x._seasonId = x._cloudId; });
      const seasonRows = seasonEntries.map(x => ({
        id: x._cloudId, seasonal_site_id: seasonalSite.id, year: x.year,
        annual_fee: x.price || 0, notes: x.notes || null
      }));
      if (seasonRows.length) assert(await client.from('site_seasons').upsert(seasonRows));
      const seasonForYear = year => seasonEntries.find(x => Number(x.year) === Number(year));

      const paymentRows = snapshot.siteFees.map(x => ({
        ...(x._cloudId != null ? { id: x._cloudId } : {}), _local: x,
        season_id: x._seasonId || seasonForYear(x.year)?._cloudId,
        payment_date: x.date, amount: x.payment, check_number: x.check || null, notes: x.notes || null
      })).filter(x => x.season_id);
      const existingPayments = paymentRows.filter(x => x.id != null).map(({ _local, ...row }) => row);
      if (existingPayments.length) assert(await client.from('seasonal_payments').upsert(existingPayments));
      for (const row of paymentRows.filter(x => x.id == null)) {
        const local = row._local;
        const { _local, ...insertRow } = row;
        const inserted = assert(await client.from('seasonal_payments').insert(insertRow).select('id').single());
        local._cloudId = inserted.id;
        row.id = inserted.id;
      }

      snapshot.electric.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const electricRows = snapshot.electric.map(x => {
        const year = Number(String(x.date).slice(0, 4));
        return {
          id: x._cloudId, season_id: x._seasonId || seasonForYear(year)?._cloudId,
          bill_date: x.date, meter_reading: x.current, amount: x.total,
          rate: x.unitPrice, payment_date: x.paid || null, check_number: x.check || null,
          notes: x.notes || null
        };
      }).filter(x => x.season_id);
      if (electricRows.length) assert(await client.from('electric_bills').upsert(electricRows));

      await removeMissing('campground_stays', new Set(ordinaryStays.map(x => x._cloudId)));
      await removeMissing('trip_fuel', new Set(snapshot.fuel.map(x => x._cloudId)));
      await removeMissing('maintenance', new Set(maintRows.map(x => x.id)));
      await removeMissing('seasonal_payments', new Set(snapshot.siteFees.map(x => x._cloudId)));
      await removeMissing('electric_bills', new Set(snapshot.electric.map(x => x._cloudId)));
      await removeMissing('site_seasons', new Set(seasonEntries.map(x => x._cloudId)));
      await removeMissing('trips', new Set(snapshot.tripSummaries.map(x => x._cloudId)));
      Object.keys(known).forEach(table => {
        const source = table === 'campground_stays' ? ordinaryStays :
          table === 'trip_fuel' ? snapshot.fuel :
          table === 'maintenance' ? maintRows.map(x => ({ _cloudId: x.id })) :
          table === 'site_seasons' ? seasonEntries :
          table === 'seasonal_payments' ? snapshot.siteFees :
          table === 'electric_bills' ? snapshot.electric : snapshot.tripSummaries;
        known[table] = new Set(source.map(x => x._cloudId));
      });
    }

    return {
      load,
      save(snapshot) {
        syncing = syncing.then(() => write(snapshot));
        return syncing;
      }
    };
  }

  window.addEventListener('adventure-cloud-ready', event => {
    window.ADVENTURE_HUB_STORE = createStore(event.detail);
    window.dispatchEvent(new CustomEvent('adventure-store-ready'));
  });
})();
